import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { db } from '../data'
import { segmentOf } from '../lib/segments'

const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function Callbacks() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { db.listCustomers().then((c) => { setRows(c); setLoading(false) }).catch(() => setLoading(false)) }, [])

  if (loading) return <p className="text-slate-400">Loading…</p>

  const now = new Date()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)

  const due = rows
    .filter((c) => c.callback_at && !['dnc', 'bad_number'].includes(segmentOf(c)))
    .map((c) => ({ ...c, cb: new Date(c.callback_at) }))
    .sort((a, b) => a.cb - b.cb)

  const overdue = due.filter((c) => c.cb < start)
  const today = due.filter((c) => c.cb >= start && c.cb <= endToday)
  const upcoming = due.filter((c) => c.cb > endToday)

  const Group = ({ title, rows, tone }) => (
    <div className="card p-5">
      <h2 className={`font-semibold mb-3 ${tone || ''}`}>{title} <span className="text-slate-400 font-normal">({rows.length})</span></h2>
      {rows.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {rows.map((c) => (
            <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-600">{c.full_name}</Link>
                <div className="text-xs text-slate-500 truncate">{c.notes || '—'}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {c.phone && <a href={`tel:${c.phone}`} className="text-brand-600 flex items-center gap-1 text-sm"><Phone size={14} />{c.phone}</a>}
                <span className="text-slate-500 w-40 text-right">{fmtDateTime(c.callback_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Callbacks</h1>
      <Group title="Overdue" rows={overdue} tone="text-rose-600" />
      <Group title="Today" rows={today} tone="text-amber-600" />
      <Group title="Upcoming" rows={upcoming} />
    </div>
  )
}
