// Square → CRM: payments and subscriptions from the website, filed automatically.
//
// Verified events only (HMAC, fail-closed). Handles:
//   payment.updated        → one-time checkout paid → file customer + invoice
//   subscription.created/  → link the Square subscription to our booking row
//     subscription.updated   (and note cancellations on the CRM customer)
//   invoice.payment_made   → subscription cycle charged → first one files the
//                            customer; later ones add a paid invoice each cycle
//
// Secrets: SQUARE_WEBHOOK_SIGNATURE_KEY. Registered URL must be EXACTLY:
//   https://iplojxexxtutrllqptil.supabase.co/functions/v1/square-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NOTIFICATION_URL = 'https://iplojxexxtutrllqptil.supabase.co/functions/v1/square-webhook'

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const today = () => new Date().toISOString().slice(0, 10)
const stampPT = () => new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })

const PLAN_WORDS: Record<string, string> = {
  monthly: 'every month', every_2: 'every 2 months', every_3: 'every 3 months',
  every_4: 'every 4 months', every_6: 'every 6 months', every_12: 'once a year',
}

async function validSignature(rawBody: string, header: string | null): Promise<boolean> {
  const key = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY')
  if (!key || !header) return false
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(NOTIFICATION_URL + rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  if (expected.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// Email via Resend. Silently skipped until RESEND_API_KEY exists, so this
// function keeps filing bookings even if email is down or not yet set up.
const OWNER_EMAIL = 'admin@elitesolarcare.com'
async function sendEmail(to: string, subject: string, text: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  const from = Deno.env.get('REMINDER_FROM_EMAIL') || 'Elite Solar Care <admin@elitesolarcare.com>'
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
    })
  } catch (_e) { /* never let email failures break payment filing */ }
}

// Create the CRM customer (or append to a phone match) and write the first
// paid invoice. Shared by one-time payments and first subscription charges.
async function fileFirstPayment(db: ReturnType<typeof admin>, bp: any, paidAmount: number, extraNote: string) {
  const note = [
    `💰 PAID WEBSITE BOOKING — ${stampPT()} PT`,
    extraNote,
    `System: ${bp.panels} panels · ${bp.stories} stories · ${bp.roof} roof · faucet: ${bp.water}` +
      (bp.commercial ? ' · COMMERCIAL' : ''),
    `Address: ${bp.street_address}, ${bp.city}`,
    bp.preferences ? `Customer notes: ${bp.preferences}` : '',
    `Phone: ${bp.phone} · Email: ${bp.email}`,
    `➡️ Money is in Square. Contact them to schedule (site promised contact within a couple of business days).`,
  ].filter(Boolean).join('\n')

  const last4 = String(bp.phone || '').slice(-4)
  const { data: candidates } = await db.from('customers')
    .select('id, phone, notes').like('phone', `%${last4}%`).limit(25)
  const match = (candidates || []).find((c: any) => digits(c.phone).slice(-10) === String(bp.phone).slice(-10))

  let customerId: string | undefined
  if (match) {
    customerId = match.id
    await db.from('customers').update({
      notes: [match.notes, note].filter(Boolean).join('\n\n'),
      callback_at: new Date().toISOString(),
    }).eq('id', match.id)
  } else {
    const parts = String(bp.name || '').split(' ')
    const { data: created } = await db.from('customers').insert({
      first_name: parts[0] || null,
      last_name: parts.slice(1).join(' ') || null,
      full_name: bp.name,
      email: bp.email, phone: bp.phone,
      street_address: bp.street_address, city: bp.city, state: 'CA',
      status: 'customer',
      lead_source: 'Website paid booking',
      source: 'website',
      panel_count: bp.panels,
      stories: Number(bp.stories) || null,
      roof_type: bp.roof,
      quoted_amount: paidAmount,
      callback_at: new Date().toISOString(),
      notes: note,
    }).select('id').single()
    customerId = created?.id
  }

  if (customerId) {
    await db.from('booking_payments').update({ crm_customer_id: customerId }).eq('id', bp.id)
    await db.from('invoices').insert({
      customer_id: customerId,
      amount: paidAmount,
      status: 'paid',
      paid_date: today(),
      payment_method: 'card',
      description: bp.plan_key === 'one_time'
        ? 'Solar Panel Cleaning — one-time (paid online)'
        : `Solar Panel Cleaning — first clean, ${PLAN_WORDS[bp.plan_key] || bp.plan_key} plan (paid online)`,
      notes: 'Paid online via Square checkout.',
    })
  }
  return customerId
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  const rawBody = await req.text()
  if (!(await validSignature(rawBody, req.headers.get('x-square-hmacsha256-signature')))) {
    return new Response('bad signature', { status: 401 })
  }

  let body: any
  try { body = JSON.parse(rawBody) } catch { return ok({ ignored: 'unparseable' }) }
  const type = String(body?.type || '')
  const db = admin()

  // ---- one-time checkout paid --------------------------------------------
  if (type === 'payment.updated' || type === 'payment.created') {
    const payment = body?.data?.object?.payment
    if (!payment || payment.status !== 'COMPLETED' || !payment.order_id) return ok({ ignored: type })

    const { data: bp } = await db.from('booking_payments')
      .select('*').eq('square_order_id', payment.order_id).single()
    if (!bp) return ok({ ignored: 'not a website booking' })
    if (bp.status === 'paid') return ok({ already: true })

    await db.from('booking_payments').update({
      status: 'paid', square_payment_id: payment.id, paid_at: new Date().toISOString(),
    }).eq('id', bp.id)

    const line = bp.plan_key === 'one_time'
      ? `One-time cleaning — PAID $${bp.amount}`
      : `${PLAN_WORDS[bp.plan_key] || bp.plan_key} plan — first clean PAID $${bp.amount}, then $${bp.per_clean}/clean auto-billed`
    await fileFirstPayment(db, bp, Number(bp.amount), line)
    await sendEmail(OWNER_EMAIL,
      `💰 Paid booking: ${bp.name} — $${bp.amount} (${bp.city})`,
      `${line}\n\n${bp.name} · ${bp.phone} · ${bp.email}\n${bp.street_address}, ${bp.city}\n` +
      `${bp.panels} panels · ${bp.stories} stories · ${bp.roof} roof · faucet: ${bp.water}\n` +
      (bp.preferences ? `Notes: ${bp.preferences}\n` : '') +
      `\nThey're in the CRM (Callbacks) — contact them within a couple of business days to schedule.\nhttps://app.elitesolarcare.com`)
    return ok({ processed: bp.id })
  }

  // ---- subscription lifecycle ----------------------------------------------
  if (type === 'subscription.created' || type === 'subscription.updated') {
    const sub = body?.data?.object?.subscription
    if (!sub?.plan_variation_id) return ok({ ignored: type })

    const { data: bp } = await db.from('booking_payments')
      .select('*').eq('square_plan_variation_id', sub.plan_variation_id).single()
    if (!bp) return ok({ ignored: 'unknown variation' })

    await db.from('booking_payments').update({
      square_subscription_id: sub.id,
      square_customer_id: sub.customer_id || null,
    }).eq('id', bp.id)

    // A cancellation deserves a loud note on the customer.
    const status = String(sub.status || '')
    if ((status === 'CANCELED' || status === 'DEACTIVATED') && bp.crm_customer_id) {
      const { data: c } = await db.from('customers').select('notes').eq('id', bp.crm_customer_id).single()
      await db.from('customers').update({
        notes: [c?.notes, `⚠️ SUBSCRIPTION ${status} in Square — ${stampPT()} PT`].filter(Boolean).join('\n\n'),
        callback_at: new Date().toISOString(),
      }).eq('id', bp.crm_customer_id)
      await sendEmail(OWNER_EMAIL,
        `⚠️ Subscription canceled: ${bp.name} (${bp.city})`,
        `${bp.name}'s ${PLAN_WORDS[bp.plan_key] || bp.plan_key} plan is ${status} in Square.\n` +
        `${bp.phone} · ${bp.email}\n\nThey're flagged in the CRM — worth a call to see what happened.`)
    }
    return ok({ linked: bp.id, status })
  }

  // ---- a subscription cycle was charged ------------------------------------
  if (type === 'invoice.payment_made') {
    const inv = body?.data?.object?.invoice
    if (!inv?.subscription_id) return ok({ ignored: 'invoice without subscription' })

    const { data: bp } = await db.from('booking_payments')
      .select('*').eq('square_subscription_id', inv.subscription_id).single()
    if (!bp) return ok({ ignored: 'unknown subscription' })

    if (bp.status !== 'paid') {
      // First charge of the subscription = the booking is paid.
      await db.from('booking_payments').update({
        status: 'paid', paid_at: new Date().toISOString(),
      }).eq('id', bp.id)
      const line = `${PLAN_WORDS[bp.plan_key] || bp.plan_key} plan — first clean PAID $${bp.amount}, ` +
        `then $${bp.per_clean}/clean AUTO-BILLED by Square 🎉 (no manual enrollment needed)`
      await fileFirstPayment(db, bp, Number(bp.amount), line)
      await sendEmail(OWNER_EMAIL,
        `🎉 NEW SUBSCRIBER: ${bp.name} — ${PLAN_WORDS[bp.plan_key] || bp.plan_key}, $${bp.per_clean}/clean (${bp.city})`,
        `${line}\n\n${bp.name} · ${bp.phone} · ${bp.email}\n${bp.street_address}, ${bp.city}\n` +
        `${bp.panels} panels · ${bp.stories} stories · ${bp.roof} roof\n` +
        (bp.preferences ? `Notes: ${bp.preferences}\n` : '') +
        `\nContact them within a couple of business days to schedule the first clean.\nhttps://app.elitesolarcare.com`)
      // California ARL acknowledgment: restate the agreed terms + how to cancel.
      await sendEmail(bp.email,
        'Your Elite Solar Care cleaning plan is active',
        `Hi ${String(bp.name || '').split(' ')[0]},\n\n` +
        `Thank you for subscribing! Here's your plan, in writing:\n\n` +
        `• Service: solar panel cleaning at ${bp.street_address}, ${bp.city}\n` +
        `• First clean: $${bp.amount} (paid today — receipt comes from Square)\n` +
        `• Then: $${bp.per_clean} automatically charged ${PLAN_WORDS[bp.plan_key] || ''}, until you cancel\n\n` +
        `Cancel anytime: call or text (279) 245-0944, reply to this email, or use the ` +
        `manage-subscription link in your Square emails.\n\n` +
        `We'll contact you within a couple of business days to set your cleaning day.\n\n` +
        `— Elite Solar Care · (279) 245-0944 · elitesolarcare.com`)
      return ok({ processed: bp.id, first: true })
    }

    // Later cycles: just put the money on the books.
    if (bp.crm_customer_id) {
      await db.from('invoices').insert({
        customer_id: bp.crm_customer_id,
        amount: Number(bp.per_clean || bp.amount),
        status: 'paid',
        paid_date: today(),
        payment_method: 'card',
        description: `Solar Panel Cleaning — plan cycle, ${PLAN_WORDS[bp.plan_key] || bp.plan_key} (auto-billed)`,
        notes: `Auto-billed by Square subscription ${inv.subscription_id}.`,
      })
      // Their panels are due again — surface them for scheduling.
      const { data: c } = await db.from('customers').select('notes').eq('id', bp.crm_customer_id).single()
      await db.from('customers').update({
        notes: [c?.notes, `🔁 PLAN CYCLE BILLED $${bp.per_clean} — schedule their next cleaning (${stampPT()} PT)`]
          .filter(Boolean).join('\n\n'),
        callback_at: new Date().toISOString(),
      }).eq('id', bp.crm_customer_id)
      await sendEmail(OWNER_EMAIL,
        `🔁 PLAN CYCLE BILLED: ${bp.name} — $${bp.per_clean} (${PLAN_WORDS[bp.plan_key] || bp.plan_key})`,
        `${bp.name}'s card was auto-charged $${bp.per_clean}.\n${bp.phone} · ${bp.email}\n` +
        `${bp.street_address}, ${bp.city}\n\nTheir panels are due — schedule the next cleaning.\nhttps://app.elitesolarcare.com`)
    }
    return ok({ processed: bp.id, cycle: true })
  }

  return ok({ ignored: type })
})
