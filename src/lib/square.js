import { FEATURES } from './config'
import { supabase } from './supabase'
import { readFunctionError } from './notifications'

// Payments are intentionally OFF until you add Square keys (VITE_PAYMENTS_ENABLED=true
// plus the Supabase secrets). This module is the single place that turns on.
//
// When enabled, invoice creation calls a Supabase Edge Function named
// "create-square-invoice" so the secret Square token stays server-side.
// (That function is added in Phase 2 — see vault CRM-Requirements.)

export const paymentsEnabled = () => FEATURES.payments && Boolean(supabase)

export async function createSquareInvoice({ customer, amount, description }) {
  if (!paymentsEnabled()) {
    throw new Error('Payments are not enabled yet. Add Square keys to turn this on.')
  }
  const { data, error } = await supabase.functions.invoke('create-square-invoice', {
    body: { customer, amount, description },
  })
  if (error) throw new Error(await readFunctionError(error, 'Could not create the Square invoice.'))
  if (data?.error) throw new Error(data.error)
  return data // { square_invoice_id, pay_url, status }
}
