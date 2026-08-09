// Public instant-quote endpoint for elitesolarcare.com.
// All pricing rules live in ./pricing.ts (shared with create-booking-request) —
// the browser only ever sees finished dollar amounts.

import { PLANS, FIRST_TIME, priceQuote } from './pricing.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const b = await req.json()
    if (!Math.floor(Number(b.panels))) {
      return json({ ok: false, reason: 'bad_input', error: 'Enter a panel count.' }, 400)
    }
    const q = priceQuote({
      panels: Number(b.panels), stories: String(b.stories || '1'),
      roof: String(b.roof || 'shingle'), city: String(b.city || ''), water: String(b.water || ''),
    })
    if (!q) return json({ ok: false, reason: 'out_of_area' })

    const r = (n: number) => Math.round(n)
    return json({
      ok: true,
      oneTime: r(q.base + FIRST_TIME),
      plans: PLANS.filter((p) => p.key !== 'one_time').map((p) => ({
        key: p.key,
        label: p.label,
        pctOff: p.pct,
        popular: !!p.popular,
        firstClean: r(q.base * (1 - p.pct / 100) + FIRST_TIME),
        perClean: r(q.base * (1 - p.pct / 100)),
      })),
      notes: {
        assumedShingle: q.roof === 'notsure' || q.roof === 'not sure',
        waterUnknown: String(b.water || '').toLowerCase() === 'notsure',
      },
    })
  } catch (_e) {
    return json({ ok: false, reason: 'bad_input', error: 'Could not read the request.' }, 400)
  }
})
