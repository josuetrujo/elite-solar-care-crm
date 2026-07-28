import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Merge, PhoneOff, X, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../data'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/dates'
import { formatPhone } from '../lib/phone'

const PAGE_SIZE = 25

// Housekeeping for an imported list: the same person entered twice, and
// contacts with no number you could actually dial. Both quietly waste calling
// time, which is the scarcest thing in this business.
export default function Cleanup() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('duplicates')

  if (!isAdmin) {
    return <p className="text-slate-500">Cleaning up the contact list is an admin-only job.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20} /> Clean up the list</h1>
        <p className="text-sm text-slate-500">
          Your 1,500-odd contacts came from two different lists, so a few people ended up in there twice
          and some rows arrived without a working phone number.
        </p>
      </div>

      <div className="flex gap-2">
        <button className={tab === 'duplicates' ? 'btn-primary !h-9' : 'btn-ghost !h-9'} onClick={() => setTab('duplicates')}>
          <Merge size={16} /> Duplicates
        </button>
        <button className={tab === 'nophone' ? 'btn-primary !h-9' : 'btn-ghost !h-9'} onClick={() => setTab('nophone')}>
          <PhoneOff size={16} /> No usable phone
        </button>
      </div>

      {tab === 'duplicates' ? <Duplicates /> : <NoPhone />}
    </div>
  )
}

function Duplicates() {
  const [groups, setGroups] = useState([])
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const g = await db.findDuplicates()
      setGroups(g)
      // Pull the full rows so the owner can see WHAT differs before merging.
      const ids = g.flatMap((x) => x.ids)
      const rows = await Promise.all(ids.map((id) => db.getCustomer(id).catch(() => null)))
      const map = {}
      rows.filter(Boolean).forEach((r) => { map[r.id] = r })
      setDetails(map)
      setError(null)
    } catch (e) {
      setError(e.message || 'Could not check for duplicates')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function merge(group, keepId) {
    const others = group.ids.filter((id) => id !== keepId)
    const keepName = details[keepId]?.full_name || 'this contact'
    if (!confirm(
      `Merge ${others.length} duplicate${others.length === 1 ? '' : 's'} into ${keepName}?\n\n`
      + 'All call history, jobs and invoices move across, and any blank fields get filled in from the duplicate. '
      + 'The duplicate rows are then deleted. This cannot be undone.',
    )) return

    setBusy(group.phone_key)
    try {
      for (const dropId of others) await db.mergeCustomers(keepId, dropId)
      setToast(`Merged into ${keepName}. ${others.length} duplicate row${others.length === 1 ? '' : 's'} removed.`)
      await load()
    } catch (e) {
      setToast(`Merge failed: ${e.message}`)
    } finally { setBusy(null) }
  }

  if (loading) return <p className="text-slate-400">Checking for duplicates…</p>
  if (error) return <p className="text-rose-600">⚠️ {error}</p>

  const extra = groups.reduce((s, g) => s + g.n - 1, 0)

  return (
    <div className="space-y-4">
      {toast && (
        <div className="card p-3 flex items-center justify-between gap-3 border-emerald-200 bg-emerald-50">
          <span className="text-sm text-emerald-900">{toast}</span>
          <button className="text-emerald-700" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No duplicate phone numbers left. Nicely tidy. 🎉
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {groups.length} phone number{groups.length === 1 ? '' : 's'} appear{groups.length === 1 ? 's' : ''} more than once
            — {extra} extra row{extra === 1 ? '' : 's'} to clear. Pick the record to keep; the rest fold into it.
          </p>

          {groups.map((g) => (
            <div key={g.phone_key} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{formatPhone(g.phone_key)}</h3>
                <span className="text-xs text-slate-400">{g.n} records</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.ids.map((id) => {
                  const c = details[id]
                  return (
                    <li key={id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <Link to={`/customers/${id}`} className="font-medium hover:text-brand-600">
                          {c?.full_name || '(no name)'}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {[c?.street_address, c?.city].filter(Boolean).join(', ') || 'no address'}
                          {c?.email ? ` · ${c.email}` : ''}
                          {' · '}{c?.call_attempts || 0} call{(c?.call_attempts || 0) === 1 ? '' : 's'}
                          {c?.last_call_at ? ` · last ${fmtDate(c.last_call_at)}` : ''}
                          {c?.notes ? ' · has notes' : ''}
                        </div>
                      </div>
                      <button
                        className="btn-ghost !h-8 !px-3 shrink-0"
                        disabled={busy === g.phone_key}
                        onClick={() => merge(g, id)}
                      >
                        <Merge size={14} /> Keep this one
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function NoPhone() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)

  function load() {
    setLoading(true)
    db.queryCustomers({ noPhone: true, page, pageSize: PAGE_SIZE })
      .then((r) => { setRows(r.rows); setTotal(r.total); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [page])

  async function park(c) {
    setBusy(c.id)
    try {
      await db.updateCustomer(c.id, { bad_number: true })
      setToast(`${c.full_name || 'Contact'} moved to the Bad Number list — out of your call queue.`)
      load()
    } catch (e) { setToast(`Didn't work: ${e.message}`) } finally { setBusy(null) }
  }

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="space-y-4">
      {toast && (
        <div className="card p-3 flex items-center justify-between gap-3 border-emerald-200 bg-emerald-50">
          <span className="text-sm text-emerald-900">{toast}</span>
          <button className="text-emerald-700" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}

      <div className="card p-4 flex items-start gap-3 text-sm text-slate-600">
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p>
          These contacts have no number you could dial — blank, or fewer than ten digits. Call Mode already
          skips them so they don't waste your time. Open one to type in a real number, or park it in the
          <b> Bad Number</b> list to get it out of the way for good.
        </p>
      </div>

      <p className="text-sm text-slate-500">
        {loading ? 'Loading…' : `${total.toLocaleString()} contact${total === 1 ? '' : 's'} with no usable number`}
      </p>

      <div className="card p-5">
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">Nothing here — every contact has a dialable number. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map((c) => (
              <li key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-600 truncate">
                    {c.full_name || '(no name)'}
                  </Link>
                  <div className="text-xs text-slate-500 truncate">
                    {c.phone ? `"${c.phone}"` : 'no number at all'}
                    {c.email ? ` · ${c.email}` : ''}
                    {c.city ? ` · ${c.city}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/customers/${c.id}`} className="btn-ghost !h-8 !px-3">Add a number</Link>
                  <button className="btn-ghost !h-8 !px-3 text-amber-700" disabled={busy === c.id} onClick={() => park(c)}>
                    <PhoneOff size={14} /> Park it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lastPage > 0 && (
        <div className="flex items-center justify-between">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="text-sm text-slate-500">Page {page + 1} of {lastPage + 1}</span>
          <button className="btn-ghost" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
