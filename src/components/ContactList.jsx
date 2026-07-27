import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { db } from '../data'
import { PIPELINE } from '../lib/config'
import { fmtDate } from '../lib/dates'
import { segmentOf } from '../lib/segments'
import { useAuth } from '../context/AuthContext'
import StatusBadge from './StatusBadge'

// Reusable contact table filtered to one segment (lead, customer, dnc, lost, bad_number).
export default function ContactList({ segment, title, subtitle, allowAdd }) {
  const { canEdit } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  useEffect(() => {
    db.listCustomers()
      .then((c) => { setRows(c); setLoading(false) })
      .catch((e) => { setError(e.message || 'Could not load customers'); setLoading(false) })
  }, [])

  const inSegment = useMemo(() => rows.filter((c) => segmentOf(c) === segment), [rows, segment])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase()
    return inSegment.filter((c) => {
      if (segment === 'lead' && status !== 'all' && c.status !== status) return false
      if (!needle) return true
      return [c.full_name, c.email, c.phone, c.city, c.street_address]
        .filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
  }, [inSegment, q, status, segment])

  async function add() {
    const row = await db.createCustomer({ full_name: 'New Customer', status: 'new_lead', recurring_frequency: 'twice_a_year', property_type: 'residential' })
    navigate(`/customers/${row.id}`)
  }

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
          <input className="input pl-9" placeholder="Search name, phone, email, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {segment === 'lead' && (
          <select className="input sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All lead stages</option>
            {PIPELINE.filter((p) => ['new_lead', 'quoted'].includes(p.key)).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        )}
      </div>

      <p className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'contact' : 'contacts'}</p>

      {error && <div className="card p-4 text-sm text-rose-600">⚠️ {error}</div>}

      <div className="card overflow-hidden">
        {loading ? <p className="p-4 text-slate-400">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">Phone</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">City</th>
                  <th className="text-left px-4 py-2">Stage</th>
                  <th className="text-left px-4 py-2 hidden lg:table-cell">{segment === 'customer' ? 'Next due' : 'Last call'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      <Link to={`/customers/${c.id}`} className="hover:text-brand-600">{c.full_name || '(no name)'}</Link>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-slate-600">{c.phone || '—'}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-slate-600">{c.city || '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-slate-600">
                      {segment === 'customer' ? fmtDate(c.next_service_due) : fmtDate(c.last_call_at)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No contacts here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
