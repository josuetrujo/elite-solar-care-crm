// Loads the merged CRM CSV into Supabase. Runs from the sandbox so contact
// data goes straight to the cloud (not through the AI). Uses a temporary
// insert policy + anon key; the policy is removed afterward.
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_ANON_KEY
const file = process.argv[2]
if (!URL || !KEY || !file) { console.error('need SUPABASE_URL, SUPABASE_ANON_KEY, and a CSV path'); process.exit(1) }

const supabase = createClient(URL, KEY)
const wb = xlsx.readFile(file, { raw: false })
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null })

const VALID_STATUS = new Set(['new_lead','quoted','scheduled','completed','recurring','lost','not_interested','customer'])
const customers = rows.map((r) => {
  const num = (v) => (v == null || v === '' ? null : Number(v))
  const bool = (v) => String(v).toLowerCase() === 'true'
  let status = (r.status || 'new_lead').trim()
  if (!VALID_STATUS.has(status)) status = 'new_lead'
  return {
    hubspot_id: r.hubspot_id || null,
    first_name: r.first_name || null,
    last_name: r.last_name || null,
    full_name: r.full_name || null,
    email: r.email || null,
    phone: r.phone || null,
    street_address: r.street_address || null,
    city: r.city || null,
    state: r.state || null,
    zip: r.zip != null ? String(r.zip) : null,
    lead_source: r.lead_source || null,
    status,
    recurring_frequency: r.recurring_frequency || 'twice_a_year',
    do_not_call: bool(r.do_not_call),
    quoted_amount: num(r.quoted_amount),
    notes: r.notes || null,
    source: r.source || null,
  }
}).filter((c) => c.full_name || c.email || c.phone)

console.log('Parsed', customers.length, 'customers. Inserting…')
let done = 0
for (let i = 0; i < customers.length; i += 500) {
  const batch = customers.slice(i, i + 500)
  const { error } = await supabase.from('customers').insert(batch, { returning: 'minimal' })
  if (error) { console.error('Insert error:', error.message); process.exit(1) }
  done += batch.length
  console.log('  inserted', done, '/', customers.length)
}
console.log('Done ✅')
