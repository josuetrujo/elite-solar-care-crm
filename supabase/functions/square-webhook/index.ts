// Square → CRM: when a website checkout is PAID, this files the booking.
//
// Square calls this URL on payment events. Every request must carry a valid
// HMAC signature made with our webhook signature key — anything unsigned or
// mis-signed is rejected, so nobody can fake a "paid" booking by posting here.
//
// On a completed payment that matches a booking_payments row:
//   1. row → status 'paid'
//   2. customer created/updated in the CRM (note says PAID — schedule now)
//   3. a paid invoice row is written so the money shows in Invoices/Reports
//
// Secrets: SQUARE_WEBHOOK_SIGNATURE_KEY (from the Square webhook subscription).
// The registered notification URL must be EXACTLY:
//   https://iplojxexxtutrllqptil.supabase.co/functions/v1/square-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const NOTIFICATION_URL = 'https://iplojxexxtutrllqptil.supabase.co/functions/v1/square-webhook'

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

async function validSignature(rawBody: string, header: string | null): Promise<boolean> {
  const key = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY')
  if (!key || !header) return false
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(NOTIFICATION_URL + rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  // Constant-time comparison.
  if (expected.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  const rawBody = await req.text()
  const signed = await validSignature(rawBody, req.headers.get('x-square-hmacsha256-signature'))
  if (!signed) return new Response('bad signature', { status: 401 })

  let body: any
  try { body = JSON.parse(rawBody) } catch { return ok({ ignored: 'unparseable' }) }

  const payment = body?.data?.object?.payment
  if (!payment || payment.status !== 'COMPLETED' || !payment.order_id) {
    return ok({ ignored: body?.type || 'no-payment' })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Only rows this website created; anything else (in-person Square sales,
  // CRM-sent invoices) is none of this function's business.
  const { data: bp } = await admin.from('booking_payments')
    .select('*').eq('square_order_id', payment.order_id).single()
  if (!bp) return ok({ ignored: 'not a website booking' })
  if (bp.status === 'paid') return ok({ already: true }) // webhook retries are normal

  await admin.from('booking_payments').update({
    status: 'paid',
    square_payment_id: payment.id,
    paid_at: new Date().toISOString(),
  }).eq('id', bp.id)

  const planLine = bp.plan_key === 'one_time'
    ? `One-time cleaning — PAID $${bp.amount}`
    : `${bp.plan_key.replace('_', ' ')} plan — first clean PAID $${bp.amount}, then $${bp.per_clean}/clean ` +
      `(⚠️ enroll their recurring plan in the Square dashboard)`

  const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const note = [
    `💰 PAID WEBSITE BOOKING — ${stamp} PT`,
    planLine,
    `System: ${bp.panels} panels · ${bp.stories} stories · ${bp.roof} roof · faucet: ${bp.water}` +
      (bp.commercial ? ' · COMMERCIAL' : ''),
    `Address: ${bp.street_address}, ${bp.city}`,
    bp.preferences ? `Customer notes: ${bp.preferences}` : '',
    `Phone: ${bp.phone} · Email: ${bp.email}`,
    `➡️ Money is in Square. Contact them to schedule (site promised contact within a couple of business days).`,
  ].filter(Boolean).join('\n')

  // Attach to an existing customer when the phone matches; otherwise create one.
  const last4 = String(bp.phone || '').slice(-4)
  const { data: candidates } = await admin.from('customers')
    .select('id, phone, notes').like('phone', `%${last4}%`).limit(25)
  const match = (candidates || []).find((c) => digits(c.phone).slice(-10) === String(bp.phone).slice(-10))

  let customerId: string
  if (match) {
    customerId = match.id
    // Existing contact: add the paid note and surface them in Callbacks, but
    // leave their pipeline status alone — the owner sets it when scheduling.
    await admin.from('customers').update({
      notes: [match.notes, note].filter(Boolean).join('\n\n'),
      callback_at: new Date().toISOString(),
    }).eq('id', match.id)
  } else {
    const parts = String(bp.name || '').split(' ')
    const { data: created } = await admin.from('customers').insert({
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
      quoted_amount: bp.amount,
      callback_at: new Date().toISOString(),
      notes: note,
    }).select('id').single()
    customerId = created?.id
  }

  if (customerId) {
    await admin.from('booking_payments').update({ crm_customer_id: customerId }).eq('id', bp.id)
    // The money is real — put it on the books as a paid invoice right away.
    await admin.from('invoices').insert({
      customer_id: customerId,
      amount: bp.amount,
      status: 'paid',
      paid_date: new Date().toISOString().slice(0, 10),
      payment_method: 'card',
      description: bp.plan_key === 'one_time'
        ? 'Solar Panel Cleaning — one-time (paid online)'
        : `Solar Panel Cleaning — first clean, ${bp.plan_key.replace('_', ' ')} plan (paid online)`,
      notes: `Paid online via Square checkout. Square payment ${payment.id}.`,
    })
  }

  return ok({ processed: bp.id })
})
