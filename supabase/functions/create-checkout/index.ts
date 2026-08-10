// "Pay & book" on elitesolarcare.com → a Square-hosted checkout page.
//
// Pay-first flow (owner, 2026-08-09): the customer pays their FIRST CLEAN
// before anything is scheduled; no date is promised at checkout — the site
// says "we'll contact you to schedule." The price is recomputed HERE from the
// same shared rules as the quote; the browser's numbers are never trusted.
// Card details live entirely on Square's page — they never touch this stack.
//
// The square-webhook function flips the booking to paid and files it in the
// CRM once Square confirms the money.

import { PLANS, FIRST_TIME, priceQuote } from './pricing.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const clip = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

const squareBase = () =>
  (Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox').toLowerCase() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const b = await req.json()
    if (String(b.website || '').trim() !== '') return json({ ok: true }) // honeypot

    const name = clip(b.name, 80)
    const phone = digits(b.phone)
    const email = clip(b.email, 120).toLowerCase()
    const street = clip(b.street_address, 120)
    const plan = PLANS.find((p) => p.key === String(b.plan_key || 'one_time'))

    if (name.length < 2) return json({ error: 'Please add your name.' }, 400)
    if (phone.length < 10 || phone.length > 11) return json({ error: 'Please add a valid phone number.' }, 400)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Please add a valid email.' }, 400)
    if (street.length < 4) return json({ error: 'Please add the service address.' }, 400)
    if (!plan) return json({ error: 'Pick a plan.' }, 400)

    const quote = priceQuote({
      panels: Number(b.panels), stories: String(b.stories || '1'),
      roof: String(b.roof || 'shingle'), city: String(b.city || ''), water: String(b.water || ''),
    })
    if (!quote) return json({ ok: false, reason: 'out_of_area' })

    const r = (n: number) => Math.round(n)
    const firstClean = r(quote.base * (1 - plan.pct / 100) + FIRST_TIME)
    const perClean = r(quote.base * (1 - plan.pct / 100))

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: row, error: insErr } = await admin.from('booking_payments').insert({
      status: 'pending',
      plan_key: plan.key,
      amount: firstClean,
      per_clean: plan.key === 'one_time' ? null : perClean,
      name, phone, email,
      street_address: street, city: clip(b.city, 60),
      panels: Math.floor(Number(b.panels)) || null,
      stories: clip(b.stories, 20), roof: clip(b.roof, 30), water: clip(b.water, 10),
      commercial: !!b.commercial,
      preferences: clip(b.preferences, 600),
    }).select('id').single()
    if (insErr || !row) return json({ error: 'Could not start checkout. Please call or text us.' }, 500)

    const token = Deno.env.get('SQUARE_ACCESS_TOKEN')
    const locationId = Deno.env.get('SQUARE_LOCATION_ID')
    if (!token || !locationId) return json({ error: 'Payments are not configured.' }, 500)

    const chargeName = plan.key === 'one_time'
      ? 'Solar Panel Cleaning — one-time'
      : `Solar Panel Cleaning — first clean (${plan.label} plan)`

    const res = await fetch(`${squareBase()}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-23',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotency_key: row.id,
        quick_pay: {
          name: chargeName,
          price_money: { amount: Math.round(firstClean * 100), currency: 'USD' },
          location_id: locationId,
        },
        checkout_options: {
          redirect_url: 'https://www.elitesolarcare.com/thank-you.html',
          merchant_support_email: 'admin@elitesolarcare.com',
        },
        pre_populated_data: {
          buyer_email: email,
          ...(phone.length === 10 ? { buyer_phone_number: `+1${phone}` } : {}),
        },
        payment_note: `Website booking ${row.id}`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.payment_link?.url) {
      const msg = data?.errors?.[0]?.detail || 'Square did not accept the checkout.'
      return json({ error: `${msg} Please call or text us and we'll take care of you.` }, 502)
    }

    await admin.from('booking_payments').update({
      square_payment_link_id: data.payment_link.id,
      square_order_id: data.payment_link.order_id,
    }).eq('id', row.id)

    return json({ ok: true, url: data.payment_link.url })
  } catch (_e) {
    return json({ error: 'Could not start checkout. Please call or text us.' }, 400)
  }
})
