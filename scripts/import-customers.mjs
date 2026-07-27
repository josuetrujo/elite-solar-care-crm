#!/usr/bin/env node
/**
 * Import the master customer list into Supabase.
 *
 * Beginner usage:
 *   1. Make sure your .env has VITE_SUPABASE_URL and a SERVICE key (see below).
 *   2. Put the spreadsheet path in the command, e.g.:
 *        SUPABASE_SERVICE_ROLE_KEY=xxx \
 *        node scripts/import-customers.mjs "/path/to/Solar Customers (Master List).xlsx"
 *
 * Notes:
 *  - This reads the xlsx LOCALLY and uploads rows to your private Supabase DB.
 *  - The spreadsheet is NEVER committed to git (it has real personal info).
 *  - Uses the SERVICE ROLE key (admin) which bypasses row-level security for
 *    the bulk insert. Keep that key secret; only use it locally.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import xlsx from 'xlsx'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const file = process.argv[2]

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}
if (!file || !fs.existsSync(file)) {
  console.error('Pass the spreadsheet path, e.g. node scripts/import-customers.mjs "Solar Customers (Master List).xlsx"')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// Map varied spreadsheet headers -> our columns.
const pick = (row, ...keys) => {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.toLowerCase().trim() === k.toLowerCase())
    if (hit && row[hit] != null && String(row[hit]).trim() !== '') return String(row[hit]).trim()
  }
  return null
}

function toCustomer(row) {
  const full = pick(row, 'First and Last Name', 'Customer Name', 'Name', 'Full Name')
  const last = pick(row, 'Last Name')
  let first = null, lastName = last
  if (full) {
    const parts = full.split(' ')
    first = parts.shift() || null
    if (!lastName) lastName = parts.join(' ') || null
  }
  return {
    first_name: first,
    last_name: lastName,
    full_name: full || [first, lastName].filter(Boolean).join(' ') || null,
    email: pick(row, 'Email', 'Email Address'),
    phone: pick(row, 'Phone Number', 'Phone'),
    street_address: pick(row, 'Street Address', 'Address', 'Adress'),
    city: pick(row, 'City'),
    state: pick(row, 'State/Prov', 'State'),
    zip: pick(row, 'Zip/Postal Code', 'Zip'),
    lead_source: 'Quality First list',
    status: 'new_lead',
    recurring_frequency: 'twice_a_year',
    notes: pick(row, 'Notes', 'Product'),
  }
}

async function main() {
  const wb = xlsx.readFile(file)
  let rows = []
  for (const sheetName of wb.SheetNames) {
    const sheet = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
    rows = rows.concat(sheet)
  }
  const customers = rows
    .map(toCustomer)
    .filter((c) => c.full_name || c.email || c.phone) // skip empty rows

  console.log(`Parsed ${customers.length} customers from "${path.basename(file)}".`)

  // Insert in batches of 500
  let inserted = 0
  for (let i = 0; i < customers.length; i += 500) {
    const batch = customers.slice(i, i + 500)
    const { error } = await supabase.from('customers').insert(batch)
    if (error) {
      console.error('Insert error:', error.message)
      process.exit(1)
    }
    inserted += batch.length
    console.log(`  inserted ${inserted}/${customers.length}`)
  }
  console.log('Done ✅')
}

main()
