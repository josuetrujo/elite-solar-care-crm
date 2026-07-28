import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronLeft, ChevronRight, PhoneOff } from 'lucide-react'
import { db } from '../data'
import { PIPELINE } from '../lib/config'
import { fmtDate } from '../lib/dates'
import { formatPhone, usablePhone } from '../lib/phone'
import { useAuth } from '../context/AuthContext'
import StatusBadge from './StatusBadge'

const PAGE_SIZE = 50

// Reusable contact table filtered to one segment (lead, customer, dnc, lost, bad_number).
// Searching and paging happen in the database, so a 1,500-row list opens as
// fast as a 10-row one.
export default function ContactList({ segment, title, subtitle, allowAdd }) {
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(0)
  const reqId = useRef(0)

  // Wait for a pause in typing before hitting the database.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(0) }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => { setPage(0) }, [status, segment])

  useEffect(() => {
    const mine = ++reqId.current
    setLoading(true)
    db.queryCustomers({ segment, q: debouncedQ, status, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (mine !== reqId.current) return // a newer search already came back
        setRows(res.rows); setTotal(res.total); setError(null); setLoading(false)
      })
      .catch((e) => {
        if (mine !== reqId.current) return
        setError(e.message || 'Could not load contacts'); setLoading(false)
      })
  }, [segment, debouncedQ, status, page])

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1
  const showingTo = Math.min(total, (page + 1) * PAGE_SIZE)

  async function add() {
    const row = await db.createCustomer({
      full_name: 'New Customer', status: 'new_lead',
      recurring_frequency: 'twice_a_year', property_type: 'residential',
    })
    navigate(`/customers/${row.id}`)
  }

  const stageOptions = useMemo(
    () => PIPELINE.filter((p) => ['new_lead', 'quoted'].includes(p.key)), [],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {allowAdd && canEdit && <button className="btn-primary" onClick={add}><Plus size={16} /> Add</button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input className="input pl-9" placeholder="Search name, phone, email, city…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {segment === 'lead' && (
          <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All lead stages</option>
            {stageOptions.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        )}
      </div>

      <p className="text-sm text-slate-500">
        {loading ? 'Searching…'
          : total === 0 ? 'No contacts match.'
            : `Showing ${showingFrom}–${showingTo} of ${total.toLocaleString()}`}
      </p>

      {error && <div className="card p-4 text-sm text-rose-600">⚠️ {error}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">City</th>
                <th className="text-left px-4 py-2">Stage</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">
                  {segment === 'customer' ? 'Next due' : 'Last call'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <Link to={`/customers/${c.id}`} className="hover:text-brand-600">{c.full_name || '(no name)'}</Link>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell text-slate-600">
                    {usablePhone(c.phone) ? formatPhone(c.phone) : (
                      <span className="inline-flex items-center gap-1 text-amber-600" title="No number we can dial">
                        <PhoneOff size={13} /> {c.phone || 'none'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{c.city || '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-slate-600">
                    {segment === 'customer' ? fmtDate(c.next_service_due) : fmtDate(c.last_call_at)}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No contacts here.</td></tr>
              )}
              {loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
