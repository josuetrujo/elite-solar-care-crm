// "Book service" on elitesolarcare.com → a booking REQUEST in the CRM.
//
// No money moves here: per the owner's spec he approves every booking, and
// payments (Square card-on-file) arrive in Phase D. This function re-prices the
// job server-side (never trusting the browser's numbers), then creates or
// updates the customer in the CRM with the full request in their notes.
//
// Public endpoint, but write-only and validated: worst case is a junk lead in
// the Leads list, never a data read.

import { PLANS, FIRST_TIME, priceQuote, normCity } from './pricing.ts'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const b = await req.json()

    // Honeypot: real people never fill a hidden "company website" field.
    if (String(b.website || '').trim() !== '') return json({ ok: true })

    const name = clip(b.name, 80)
    const phone = digits(b.phone)
    const email = clip(b.email, 120).toLowerCase()
    const street = clip(b.street_address, 120)
    const prefs = clip(b.preferences, 600)
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
    const perClean = r(quote.base * (1 - plan.pct / 100))
    const firstClean = r(quote.base * (1 - plan.pct / 100) + FIRST_TIME)
    const city = clip(b.city, 60)

    const stamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const note = [
      `📥 WEBSITE BOOKING REQUEST — ${stamp} PT`,
      `Plan: ${plan.label}${plan.pct ? ` (${plan.pct}% off)` : ''} — first clean $${firstClean}` +
        (plan.key === 'one_time' ? '' : `, then $${perClean}/clean`),
      `System: ${Math.floor(Number(b.panels))} panels · ${clip(b.stories, 20)} stories · ${clip(b.roof, 20)} roof · faucet: ${clip(b.water, 10)}` +
        (b.commercial ? ' · COMMERCIAL' : ''),
      `Address: ${street}, ${city}`,
      prefs ? `Preferred timing: ${prefs}` : '',
      `Phone: ${phone} · Email: ${email}`,
      `⚠️ Requested online — call/text to confirm a day and arrival window.`,
    ].filter(Boolean).join('\n')

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Same person twice (they're in the 1,521-lead list, or they re-request):
    // append to their record instead of duplicating it.
    const last4 = phone.slice(-4)
    const { data: candidates } = await admin
      .from('customers').select('id, phone, notes')
      .like('phone', `%${last4}%`).limit(25)
    const match = (candidates || []).find((c) => digits(c.phone).slice(-10) === phone.slice(-10))

    if (match) {
      await admin.from('customers').update({
        notes: [match.notes, note].filter(Boolean).join('\n\n'),
        callback_at: new Date().toISOString(),
      }).eq('id', match.id)
    } else {
      const parts = name.split(' ')
      await admin.from('customers').insert({
        first_name: parts[0],
        last_name: parts.slice(1).join(' ') || null,
        full_name: name,
        email, phone,
        street_address: street, city: city || normCity(city), state: 'CA',
        status: 'new_lead',
        lead_source: 'Website booking request',
        source: 'website',
        panel_count: Math.floor(Number(b.panels)) || null,
        stories: Number(b.stories) || null,
        roof_type: clip(b.roof, 30) || null,
        quoted_amount: firstClean,
        callback_at: new Date().toISOString(),
        notes: note,
      })
    }

    return json({ ok: true })
  } catch (_e) {
    return json({ error: 'Could not send your request. Please call or text us.' }, 400)
  }
})
