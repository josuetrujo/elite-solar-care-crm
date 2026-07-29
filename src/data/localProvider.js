// LOCAL DEMO provider: stores data in the browser (localStorage).
// Used automatically when no Supabase keys are present, so the app is fully
// clickable with sample data and zero setup.
import { sampleCustomers, sampleJobs, sampleCalls } from './sampleCustomers'
import { DISPOSITIONS } from '../lib/config'
import { segmentOf } from '../lib/segments'
import { usablePhone, phoneKey } from '../lib/phone'

const CKEY = 'esc_customers'
const JKEY = 'esc_jobs'
const LKEY = 'esc_calls'
const IKEY = 'esc_invoices'
const PKEY = 'esc_job_photos'

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
  // Same shape as the Supabase version, done in the browser over sample data.
  async queryCustomers({ segment, q, status, page = 0, pageSize = 50, noPhone = false } = {}) {
    const needle = (q || '').trim().toLowerCase()
    const all = load(CKEY, sampleCustomers)
      .filter((c) => (segment ? segmentOf(c) === segment : true))
      .filter((c) => (status && status !== 'all' ? c.status === status : true))
      .filter((c) => (noPhone ? !usablePhone(c.phone) : true))
      .filter((c) => !needle || [
        c.full_name, c.phone, c.email, c.city, c.street_address,
        c.billing_name, c.billing_city, c.billing_street_address,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
    const from = page * pageSize
    return { rows: all.slice(from, from + pageSize), total: all.length }
  },

  async countCustomersBySegment() {
    const all = load(CKEY, sampleCustomers)
    const out = { lead: 0, customer: 0, lost: 0, bad_number: 0, dnc: 0 }
    for (const c of all) out[segmentOf(c)] = (out[segmentOf(c)] || 0) + 1
    return out
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
  // ---- job photos (demo mode keeps a small preview in the browser) ----------
  async listJobPhotos(customerId) {
    return load(PKEY, []).filter((p) => p.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  },
  async addJobPhoto({ customerId, jobId, kind, caption, dataUrl }) {
    const all = load(PKEY, [])
    const row = {
      id: uid(), customer_id: customerId, job_id: jobId || null,
      kind: kind || 'after', caption: caption || null,
      url: dataUrl, path: 'demo', created_at: new Date().toISOString(),
    }
    all.unshift(row)
    save(PKEY, all)
    return row
  },
  async deleteJobPhoto(photo) {
    save(PKEY, load(PKEY, []).filter((p) => p.id !== photo.id))
  },

  // ---- list hygiene & reporting (browser-side equivalents) ------------------
  async findDuplicates() {
    const groups = {}
    for (const c of load(CKEY, sampleCustomers)) {
      const k = phoneKey(c.phone)
      if (!k) continue
      ;(groups[k] ||= []).push(c)
    }
    return Object.entries(groups)
      .filter(([, rows]) => rows.length > 1)
      .map(([phone_key, rows]) => ({
        phone_key,
        ids: rows.map((r) => r.id),
        names: rows.map((r) => r.full_name || '(no name)'),
        n: rows.length,
      }))
  },
  async mergeCustomers(keepId, dropId) {
    const all = load(CKEY, sampleCustomers)
    const keep = all.find((c) => c.id === keepId)
    const drop = all.find((c) => c.id === dropId)
    if (!keep || !drop) throw new Error('Not found')
    for (const k of Object.keys(drop)) {
      if (k === 'id') continue
      if (keep[k] === null || keep[k] === undefined || keep[k] === '') keep[k] = drop[k]
    }
    keep.call_attempts = (keep.call_attempts || 0) + (drop.call_attempts || 0)
    keep.do_not_call = !!keep.do_not_call || !!drop.do_not_call
    keep.notes = [keep.notes, drop.notes].filter(Boolean).join('\n')
    save(CKEY, all.filter((c) => c.id !== dropId))
    for (const key of [JKEY, LKEY, IKEY]) {
      const rows = load(key, key === JKEY ? sampleJobs : key === LKEY ? sampleCalls : [])
      save(key, rows.map((r) => (r.customer_id === dropId ? { ...r, customer_id: keepId } : r)))
    }
  },
  async report() {
    const cust = load(CKEY, sampleCustomers)
    const inv = load(IKEY, [])
    const jobs = load(JKEY, sampleJobs)
    const calls = load(LKEY, sampleCalls)
    const paid = inv.filter((i) => i.status === 'paid')
    const byMonth = {}
    for (const i of paid) {
      const m = String(i.paid_date || i.created_at).slice(0, 7)
      byMonth[m] ||= { month: m, total: 0, jobs: 0 }
      byMonth[m].total += Number(i.amount || 0)
      byMonth[m].jobs += 1
    }
    const byOutcome = {}
    for (const c of calls) byOutcome[c.disposition] = (byOutcome[c.disposition] || 0) + 1
    const sum = (a) => a.reduce((s, i) => s + Number(i.amount || 0), 0)
    return {
      revenue_by_month: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
      outstanding: sum(inv.filter((i) => ['unpaid', 'sent'].includes(i.status))),
      collected: sum(paid),
      avg_ticket: paid.length ? sum(paid) / paid.length : 0,
      calls_total: calls.length,
      calls_by_outcome: byOutcome,
      contacts_total: cust.length,
      customers_total: cust.filter((c) => segmentOf(c) === 'customer').length,
      leads_total: cust.filter((c) => segmentOf(c) === 'lead').length,
      jobs_completed: jobs.filter((j) => j.status === 'completed').length,
      jobs_scheduled: jobs.filter((j) => j.status === 'scheduled').length,
      unreachable: cust.filter((c) => !usablePhone(c.phone)).length,
    }
  },

  // ---- team (demo mode has a single pretend admin) --------------------------
  async listProfiles() {
    return [{
      id: 'demo', name: 'Demo Admin', email: 'demo@elitesolarcare.local',
      role: 'admin', approved: true, created_at: new Date().toISOString(),
    }]
  },
  async updateProfile(id, patch) {
    return { id, ...patch }
  },
  async resetDemo() {
    save(CKEY, sampleCustomers)
    save(JKEY, sampleJobs)
    save(LKEY, sampleCalls)
    save(IKEY, [])
  },
}
