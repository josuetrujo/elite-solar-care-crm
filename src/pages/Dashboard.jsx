import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarClock, AlertTriangle, DollarSign, PhoneCall, PhoneOutgoing } from 'lucide-react'
import { db } from '../data'
import { PIPELINE } from '../lib/config'
import { segmentOf } from '../lib/segments'
import { daysUntil, fmtDate, fmtMoney } from '../lib/dates'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const [customers, setCustomers] = useState([])
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([db.listCustomers(), db.listCalls()])
      .then(([c, k]) => { setCustomers(c); setCalls(k); setLoading(false) })
      .catch((e) => { setError(e.message || 'Could not load data'); setLoading(false) })
  }, [])

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-rose-600">⚠️ {error}</p>

  const leads = customers.filter((c) => segmentOf(c) === 'lead')
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)
  const callbacksDue = leads.filter((c) => c.callback_at && new Date(c.callback_at) <= endToday)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const callsToday = calls.filter((c) => new Date(c.called_at) >= todayStart)
  const total = customers.length
  const dueSoon = customers.filter((c) => { const d = daysUntil(c.next_service_due); return d != null && d <= 14 && d >= 0 })
  const overdue = customers.filter((c) => { const d = daysUntil(c.next_service_due); return d != null && d < 0 })
  const pipelineValue = customers
    .filter((c) => ['quoted', 'scheduled'].includes(c.status))
    .reduce((s, c) => s + (Number(c.quoted_amount) || 0), 0)

  const byStatus = PIPELINE.map((p) => ({ ...p, count: customers.filter((c) => c.status === p.key).length }))

  const stat = (icon, label, value, to) => (
    <Link to={to || '#'} className="card p-4 flex items-center gap-3 hover:shadow-md transition">
      <div className="rounded-lg bg-brand-50 text-brand-600 p-2">{icon}</div>
      <div><div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-slate-500 mt-1">{label}</div></div>
    </Link>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stat(<PhoneCall size={20} />, 'Leads to call', leads.length, '/leads')}
        {stat(<CalendarClock size={20} />, 'Callbacks due', callbacksDue.length, '/callbacks')}
        {stat(<PhoneOutgoing size={20} />, 'Calls today', callsToday.length, '/leads')}
        {stat(<Users size={20} />, 'Customers', customers.filter((c) => segmentOf(c) === 'customer').length, '/customers')}
        {stat(<AlertTriangle size={20} />, 'Service overdue', overdue.length, '/schedule')}
        {stat(<DollarSign size={20} />, 'Open pipeline', fmtMoney(pipelineValue))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">Pipeline</h2>
          <div className="space-y-2">
            {byStatus.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <StatusBadge status={s.key} />
                <span className="text-sm font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Needs attention</h2>
            <Link to="/schedule" className="text-sm text-brand-600 hover:underline">View schedule</Link>
          </div>
          {[...overdue, ...dueSoon].length === 0 ? (
            <p className="text-sm text-slate-400">Nothing due in the next two weeks. 🎉</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {[...overdue, ...dueSoon].slice(0, 8).map((c) => {
                const d = daysUntil(c.next_service_due)
                return (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-600">{c.full_name}</Link>
                    <span className={`text-sm ${d < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                      {d < 0 ? `${Math.abs(d)}d overdue` : `in ${d}d`} · {fmtDate(c.next_service_due)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
