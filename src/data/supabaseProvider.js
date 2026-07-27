// Real cloud provider, used when Supabase keys are present.
import { supabase } from '../lib/supabase'

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

export const supabaseProvider = {
  async listCustomers() {
    // Supabase caps a response at 1,000 rows — page through so ALL contacts load.
    const all = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from('customers').select('*')
        .order('created_at', { ascending: false })
        .range(from, from + page - 1)
      if (error) throw error
      all.push(...data)
      if (data.length < page) break
    }
    return all
  },
  async getCustomer(id) {
    return unwrap(await supabase.from('customers').select('*').eq('id', id).single())
  },
  async createCustomer(data) {
    return unwrap(await supabase.from('customers').insert(data).select().single())
  },
  async updateCustomer(id, patch) {
    return unwrap(await supabase.from('customers').update(patch).eq('id', id).select().single())
  },
  async deleteCustomer(id) {
    return unwrap(await supabase.from('customers').delete().eq('id', id))
  },
  async listJobs(customerId) {
    let q = supabase.from('jobs').select('*').order('scheduled_date', { ascending: false })
    if (customerId) q = q.eq('customer_id', customerId)
    return unwrap(await q)
  },
  async createJob(data) {
    return unwrap(await supabase.from('jobs').insert(data).select().single())
  },
  async updateJob(id, patch) {
    return unwrap(await supabase.from('jobs').update(patch).eq('id', id).select().single())
  },
  async listInvoices(customerId) {
    let q = supabase.from('invoices').select('*').order('created_at', { ascending: false })
    if (customerId) q = q.eq('customer_id', customerId)
    return unwrap(await q)
  },
  async createInvoice(data) {
    return unwrap(await supabase.from('invoices').insert(data).select().single())
  },
  async updateInvoice(id, patch) {
    return unwrap(await supabase.from('invoices').update(patch).eq('id', id).select().single())
  },
  async deleteInvoice(id) {
    return unwrap(await supabase.from('invoices').delete().eq('id', id))
  },
  async listCalls(customerId) {
    if (customerId) {
      return unwrap(await supabase.from('calls').select('*').eq('customer_id', customerId).order('called_at', { ascending: false }))
    }
    // Page through all calls (used for dashboard "calls today").
    const all = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const { data, error } = await supabase
        .from('calls').select('*')
        .order('called_at', { ascending: false })
        .range(from, from + page - 1)
      if (error) throw error
      all.push(...data)
      if (data.length < page) break
    }
    return all
  },
  async createCall(data) {
    return unwrap(await supabase.from('calls').insert(data).select().single())
  },
  // Atomic: inserts the call + patches the customer in one DB transaction.
  async logDisposition(customer, dispositionKey, opts = {}) {
    const s = opts.sale || {}
    const { error } = await supabase.rpc('log_call_disposition', {
      p_customer_id: customer.id,
      p_disposition: dispositionKey,
      p_note: opts.note || null,
      p_callback_at: opts.callbackAt || null,
      p_sale_panel_count: s.panel_count ?? null,
      p_sale_amount: s.quoted_amount ?? null,
      p_sale_recurring: s.recurring_frequency || null,
      p_sale_notes: s.notes || null,
    })
    if (error) throw error
  },
  async resetDemo() {
    throw new Error('Reset is only available in demo mode.')
  },
}
