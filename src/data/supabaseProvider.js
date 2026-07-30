// Real cloud provider, used when Supabase keys are present.
import { supabase } from '../lib/supabase'
// The status groups come from lib/segments.js so the database filter and the
// browser-side segmentOf() can never drift apart.
import { CUSTOMER_STATUSES, LOST_STATUSES, LEAD_STATUSES } from '../lib/segments'

const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

function applySegment(sel, segment) {
  switch (segment) {
    case 'dnc':
      return sel.eq('do_not_call', true)
    case 'bad_number':
      return sel.eq('do_not_call', false).eq('bad_number', true)
    case 'customer':
      return sel.eq('do_not_call', false).eq('bad_number', false).in('status', CUSTOMER_STATUSES)
    case 'lost':
      return sel.eq('do_not_call', false).eq('bad_number', false).in('status', LOST_STATUSES)
    case 'lead':
      return sel.eq('do_not_call', false).eq('bad_number', false).in('status', LEAD_STATUSES)
    default:
      return sel
  }
}

// PostgREST's .or() is comma/parenthesis-delimited, so those characters in a
// search box would corrupt the query. Strip them rather than escape them.
const sanitize = (s) => (s || '').trim().replace(/[,()%*\\]/g, '').slice(0, 60)

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
  // Server-side search + paging. The old approach downloaded every contact and
  // rendered every row, which is slow on a phone once the list passes a few
  // hundred. This asks Postgres for one page at a time.
  async queryCustomers({ segment, q, status, page = 0, pageSize = 50, noPhone = false } = {}) {
    let sel = supabase.from('customers').select('*', { count: 'exact' })
    sel = applySegment(sel, segment)
    if (status && status !== 'all') sel = sel.eq('status', status)
    if (noPhone) sel = sel.or('phone.is.null,phone.eq.')

    const needle = sanitize(q)
    if (needle) {
      sel = sel.or(
        ['full_name', 'phone', 'email', 'city', 'street_address',
         'billing_name', 'billing_city', 'billing_street_address']
          .map((c) => `${c}.ilike.%${needle}%`).join(','),
      )
    }

    const from = page * pageSize
    const { data, error, count } = await sel
      .order('full_name', { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    return { rows: data || [], total: count ?? 0 }
  },

  async countCustomersBySegment() {
    const out = {}
    for (const seg of ['lead', 'customer', 'lost', 'bad_number', 'dnc']) {
      const { count, error } = await applySegment(
        supabase.from('customers').select('id', { count: 'exact', head: true }), seg,
      )
      if (error) throw error
      out[seg] = count ?? 0
    }
    const { count, error } = await supabase.from('customers').select('id', { count: 'exact', head: true })
    if (error) throw error
    out.all = count ?? 0
    return out
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
  // ---- job photos ----------------------------------------------------------
  // Files live in a private bucket; the app reads them through short-lived
  // signed URLs so a leaked link can't expose a customer's home.
  async listJobPhotos(customerId) {
    const rows = unwrap(await supabase.from('job_photos').select('*')
      .eq('customer_id', customerId).order('created_at', { ascending: false }))
    if (!rows.length) return []
    const { data: signed } = await supabase.storage.from('job-photos')
      .createSignedUrls(rows.map((r) => r.path), 3600)
    const urlFor = {}
    ;(signed || []).forEach((s) => { if (s.path) urlFor[s.path] = s.signedUrl })
    return rows.map((r) => ({ ...r, url: urlFor[r.path] || null }))
  },

  async addJobPhoto({ customerId, jobId, kind, caption, blob }) {
    const path = `${customerId}/${crypto.randomUUID()}.jpg`
    const { error: upErr } = await supabase.storage.from('job-photos')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (upErr) throw upErr
    try {
      return unwrap(await supabase.from('job_photos').insert({
        customer_id: customerId, job_id: jobId || null, path,
        kind: kind || 'after', caption: caption || null,
      }).select().single())
    } catch (e) {
      // Don't leave an orphan file behind if the row insert fails.
      await supabase.storage.from('job-photos').remove([path])
      throw e
    }
  },

  async deleteJobPhoto(photo) {
    await supabase.storage.from('job-photos').remove([photo.path])
    return unwrap(await supabase.from('job_photos').delete().eq('id', photo.id))
  },

  // ---- list hygiene & reporting --------------------------------------------
  async findDuplicates() {
    return unwrap(await supabase.rpc('find_duplicate_contacts'))
  },
  async mergeCustomers(keepId, dropId) {
    const { error } = await supabase.rpc('merge_customers', { p_keep: keepId, p_drop: dropId })
    if (error) throw error
  },
  async report() {
    return unwrap(await supabase.rpc('crm_report'))
  },

  // ---- team ----------------------------------------------------------------
  async listProfiles() {
    return unwrap(await supabase.from('profiles').select('*').order('created_at', { ascending: true }))
  },
  async updateProfile(id, patch) {
    return unwrap(await supabase.from('profiles').update(patch).eq('id', id).select().single())
  },
  async resetDemo() {
    throw new Error('Reset is only available in demo mode.')
  },
}
