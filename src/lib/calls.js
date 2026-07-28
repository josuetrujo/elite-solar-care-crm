import { db } from '../data'
import { enqueue, flush, isConnectionError, pendingCount, onPendingChange } from './offline'

// Records a call and applies its side-effects to the customer.
// Delegates to the active data provider:
//  - Supabase: a single atomic RPC (log_call_disposition) — no partial writes.
//  - Local demo: two-step write in the browser.
// opts: { note, callbackAt (ISO), sale: { panel_count, quoted_amount, recurring_frequency, notes } }
//
// If the network is down the outcome is stored in the browser and sent later,
// so a weak signal never costs a logged call. Returns { queued: true } then.
export async function logDisposition(customer, dispositionKey, opts = {}) {
  try {
    await db.logDisposition(customer, dispositionKey, opts)
    return { queued: false }
  } catch (e) {
    if (!isConnectionError(e)) throw e
    enqueue({
      customerId: customer.id,
      customerName: customer.full_name,
      dispositionKey,
      opts,
    })
    return { queued: true }
  }
}

// Replays queued outcomes against the database, oldest first.
export function syncOutbox() {
  return flush((item) =>
    db.logDisposition({ id: item.customerId }, item.dispositionKey, item.opts))
}

export { pendingCount, onPendingChange }
