// "Pay & book" on elitesolarcare.com → a Square-hosted checkout page.
//
// One-time cleans: a simple pay-once checkout.
// Plans: a SUBSCRIPTION checkout — Square stores the card and auto-bills every
// cycle. The plan variation has two phases: the first clean (higher, includes
// the first-visit surcharge) billed at checkout, then the discounted per-clean
// price forever after, on the plan's cadence. Cancel handling stays in Square.
//
// Prices are recomputed HERE from shared rules; the browser is never trusted.
// Card details live entirely on Square's page — they never touch this stack.

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

const SQUARE_VERSION = '2025-01-23'
const squareBase = () =>
  (Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox').toLowerCase() === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'

async function square(path: string, method: string, body?: unknown) {
  const token = Deno.env.get('SQUARE_ACCESS_TOKEN')
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set.')
  const res = await fetch(`${squareBase()}${path}`, {
    method,
    headers: {
      'Square-Version': SQUARE_VERSION,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.detail || data?.errors?.[0]?.code || res.statusText)
  }
  return data
}

// Square billing cadences for the owner's plan frequencies.
const CADENCE: Record<string, string> = {
  monthly: 'MONTHLY',
  every_2: 'EVERY_TWO_MONTHS',
  every_3: 'QUARTERLY',
  every_4: 'EVERY_FOUR_MONTHS',
  every_6: 'EVERY_SIX_MONTHS',
  every_12: 'ANNUAL',
}

// One shared parent plan in the catalog; each checkout adds a variation with
// that customer's exact pricing.
async function findOrCreateParentPlan(): Promise<string> {
  const found = await square('/v2/catalog/search', 'POST', {
    object_types: ['SUBSCRIPTION_PLAN'],
    limit: 100,
  }).catch(() => null)
  const existing = found?.objects?.find(
    (o: any) => o?.subscription_plan_data?.name === 'Solar Panel Cleaning Plans',
  )
  if (existing) return existing.id

  const created = await square('/v2/catalog/object', 'POST', {
    idempotency_key: crypto.randomUUID(),
    object: {
      type: 'SUBSCRIPTION_PLAN',
      id: '#esc_plans',
      subscription_plan_data: { name: 'Solar Panel Cleaning Plans' },
    },
  })
  return created.catalog_object.id
}

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
    // California ARL: recurring plans need express affirmative consent.
    if (plan.key !== 'one_time' && b.consent !== true) {
      return json({ error: 'Please check the box agreeing to the automatic billing terms.' }, 400)
    }

    const quote = priceQuote({
      panels: Number(b.panels), stories: String(b.stories || '1'),
      roof: String(b.roof || 'shingle'), city: String(b.city || ''), water: String(b.water || ''),
    })
    if (!quote) return json({ ok: false, reason: 'out_of_area' })

    const r = (n: number) => Math.round(n)
    const firstClean = r(quote.base * (1 - plan.pct / 100) + FIRST_TIME)
    const perClean = r(quote.base * (1 - plan.pct / 100))
    const isSubscription = plan.key !== 'one_time'

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: row, error: insErr } = await admin.from('booking_payments').insert({
      status: 'pending',
      plan_key: plan.key,
      amount: firstClean,
      per_clean: isSubscription ? perClean : null,
      name, phone, email,
      street_address: street, city: clip(b.city, 60),
      panels: Math.floor(Number(b.panels)) || null,
      stories: clip(b.stories, 20), roof: clip(b.roof, 30), water: clip(b.water, 10),
      commercial: !!b.commercial,
      preferences: clip(b.preferences, 600),
      // Server-composed canonical terms — the record of what they agreed to.
      consent_text: isSubscription
        ? `Agreed at checkout: card automatically charged $${perClean} ${plan.label.toLowerCase()} ` +
          `after a first clean of $${firstClean}, continuing until cancelled. Cancel anytime: call/text ` +
          `(888) 883-3008, email admin@elitesolarcare.com, or use the manage-subscription link in Square emails.`
        : null,
      consented_at: isSubscription ? new Date().toISOString() : null,
    }).select('id').single()
    if (insErr || !row) return json({ error: 'Could not start checkout. Please call or text us.' }, 500)

    const locationId = Deno.env.get('SQUARE_LOCATION_ID')
    if (!locationId) return json({ error: 'Payments are not configured.' }, 500)

    let variationId: string | null = null
    if (isSubscription) {
      // Two phases: the pricier first clean once, then the plan price forever.
      const parentId = await findOrCreateParentPlan()
      const cadence = CADENCE[plan.key]
      const variation = await square('/v2/catalog/object', 'POST', {
        idempotency_key: row.id,
        object: {
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: '#esc_variation',
          subscription_plan_variation_data: {
            name: `${plan.label} — ${clip(b.city, 30)} ${Math.floor(Number(b.panels))}p (${row.id.slice(0, 8)})`,
            subscription_plan_id: parentId,
            phases: [
              {
                cadence, ordinal: 0, periods: 1,
                pricing: { type: 'STATIC', price_money: { amount: firstClean * 100, currency: 'USD' } },
              },
              {
                cadence, ordinal: 1,
                pricing: { type: 'STATIC', price_money: { amount: perClean * 100, currency: 'USD' } },
              },
            ],
          },
        },
      })
      variationId = variation.catalog_object.id
      await admin.from('booking_payments').update({ square_plan_variation_id: variationId }).eq('id', row.id)
    }

    const chargeName = isSubscription
      ? `Solar Panel Cleaning — ${plan.label} plan`
      : 'Solar Panel Cleaning — one-time'

    const linkBody: Record<string, unknown> = {
      idempotency_key: `link-${row.id}`,
      quick_pay: {
        name: chargeName,
        price_money: { amount: firstClean * 100, currency: 'USD' },
        location_id: locationId,
      },
      checkout_options: {
        redirect_url: 'https://www.elitesolarcare.com/thank-you.html',
        merchant_support_email: 'admin@elitesolarcare.com',
        ...(isSubscription ? { subscription_plan_id: variationId } : {}),
      },
      pre_populated_data: {
        buyer_email: email,
        ...(phone.length === 10 ? { buyer_phone_number: `+1${phone}` } : {}),
      },
      payment_note: `Website booking ${row.id}`,
    }

    const link = await square('/v2/online-checkout/payment-links', 'POST', linkBody)
    if (!link?.payment_link?.url) {
      return json({ error: "Square did not accept the checkout. Please call or text us and we'll take care of you." }, 502)
    }

    await admin.from('booking_payments').update({
      square_payment_link_id: link.payment_link.id,
      square_order_id: link.payment_link.order_id,
    }).eq('id', row.id)

    return json({ ok: true, url: link.payment_link.url })
  } catch (e) {
    return json({ error: `${(e as Error).message || 'Could not start checkout.'} Please call or text us and we'll take care of you.` }, 502)
  }
})
