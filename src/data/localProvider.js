// LOCAL DEMO provider: stores data in the browser (localStorage).
// Used automatically when no Supabase keys are present, so the app is fully
// clickable with sample data and zero setup.
import { sampleCustomers, sampleJobs, sampleCalls } from './sampleCustomers'
import { DISPOSITIONS } from '../lib/config'

const CKEY = 'esc_customers'
const JKEY = 'esc_jobs'
const LKEY = 'esc_calls'
const IKEY = 'esc_invoices'

function load(key, seed) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  localStorage.setItem(key, JSON.stringify(seed))
  return JSON.parse(JSON.stringify(seed))
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val))
}
const uid = () => 'id' + Math.random().toString(36).slice(2, 10)

export const localProvider = {
  async listCustomers() {
    return load(CKEY, sampleCustomers)
  },
  async getCustomer(id) {
    return load(CKEY, sampleCustomers).find((c) => c.id === id) || null
  },
  async createCustomer(data) {
    const all = load(CKEY, sampleCustomers)
    const row = { id: uid(), tags: [], created_at: new Date().toISOString(), ...data }
    all.unshift(row)
    save(CKEY, all)
    return row
  },
  async updateCustomer(id, patch) {
    const all = load(CKEY, sampleCustomers)
    const i = all.findIndex((c) => c.id === id)
    if (i === -1) throw new Error('Not found')
    all[i] = { ...all[i], ...patch, updated_at: new Date().toISOString() }
    save(CKEY, all)
    return all[i]
  },
  async deleteCustomer(id) {
    const all = load(CKEY, sampleCustomers).filter((c) => c.id !== id)
    save(CKEY, all)
  },
  async listJobs(customerId) {
    const all = load(JKEY, sampleJobs)
    return customerId ? all.filter((j) => j.customer_id === customerId) : all
  },
  async createJob(data) {
    const all = load(JKEY, sampleJobs)
    const row = { id: uid(), status: 'scheduled', created_at: new Date().toISOString(), ...data }
    all.unshift(row)
    save(JKEY, all)
    return row
  },
  async updateJob(id, patch) {
    const all = load(JKEY, sampleJobs)
    const i = all.findIndex((j) => j.id === id)
    if (i === -1) throw new Error('Not found')
    all[i] = { ...all[i], ...patch }
    save(JKEY, all)
    return all[i]
  },
  async listInvoices(customerId) {
    const all = load(IKEY, [])
    const rows = customerId ? all.filter((i) => i.customer_id === customerId) : all
    return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  },
  async createInvoice(data) {
    const all = load(IKEY, [])
    // Demo receipt numbers continue from the last paper receipt (ESC-1002).
    const nextNo = all.reduce((m, i) => Math.max(m, i.receipt_no || 1002), 1002) + 1
    const row = {
      id: uid(), status: 'unpaid', discount: 0, tax: 0,
      receipt_no: nextNo, created_at: new Date().toISOString(), ...data,
    }
    all.unshift(row)
    save(IKEY, all)
    return row
  },
  async updateInvoice(id, patch) {
    const all = load(IKEY, [])
    const i = all.findIndex((x) => x.id === id)
    if (i === -1) throw new Error('Not found')
    all[i] = { ...all[i], ...patch }
    save(IKEY, all)
    return all[i]
  },
  async deleteInvoice(id) {
    save(IKEY, load(IKEY, []).filter((i) => i.id !== id))
  },
  async listCalls(customerId) {
    const all = load(LKEY, sampleCalls)
    const rows = customerId ? all.filter((c) => c.customer_id === customerId) : all
    return rows.sort((a, b) => new Date(b.called_at) - new Date(a.called_at))
  },
  async createCall(data) {
    const all = load(LKEY, sampleCalls)
    const row = { id: uid(), called_at: new Date().toISOString(), ...data }
    all.unshift(row)
    save(LKEY, all)
    return row
  },
  async logDisposition(customer, dispositionKey, opts = {}) {
    const def = DISPOSITIONS.find((d) => d.key === dispositionKey)
    if (!def) throw new Error('Unknown outcome: ' + dispositionKey)
    const now = new Date().toISOString()
    await this.createCall({
      customer_id: customer.id, called_at: now, disposition: dispositionKey,
      note: opts.note || null,
      callback_at: dispositionKey === 'call_later' ? opts.callbackAt || null : null,
    })
    const patch = {
      last_call_at: now, last_disposition: dispositionKey,
      call_attempts: (customer.call_attempts || 0) + 1,
    }
    if (dispositionKey === 'call_later') patch.callback_at = opts.callbackAt || null
    if (def.setsStatus) patch.status = def.setsStatus
    if (def.setsBadNumber) patch.bad_number = true
    if (def.setsDnc) patch.do_not_call = true
    if (dispositionKey === 'sale') {
      patch.callback_at = null
      const s = opts.sale || {}
      if (s.panel_count != null) patch.panel_count = s.panel_count
      if (s.quoted_amount != null) patch.quoted_amount = s.quoted_amount
      if (s.recurring_frequency) patch.recurring_frequency = s.recurring_frequency
      if (s.notes) patch.notes = [customer.notes, s.notes].filter(Boolean).join(' | ')
    }
    return this.updateCustomer(customer.id, patch)
  },
  async resetDemo() {
    save(CKEY, sampleCustomers)
    save(JKEY, sampleJobs)
    save(LKEY, sampleCalls)
    save(IKEY, [])
  },
}
