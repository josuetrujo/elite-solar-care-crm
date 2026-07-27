import { db } from '../data'

// Records a call and applies its side-effects to the customer.
// Delegates to the active data provider:
//  - Supabase: a single atomic RPC (log_call_disposition) — no partial writes.
//  - Local demo: two-step write in the browser.
// opts: { note, callbackAt (ISO), sale: { panel_count, quoted_amount, recurring_frequency, notes } }
export function logDisposition(customer, dispositionKey, opts = {}) {
  return db.logDisposition(customer, dispositionKey, opts)
}
