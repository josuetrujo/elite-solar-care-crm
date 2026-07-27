import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, List as ListIcon, ChevronLeft, ChevronRight,
  CheckCircle2, CalendarPlus, Phone, X,
} from 'lucide-react'
import { db } from '../data'
import { useAuth } from '../context/AuthContext'
import { daysUntil, fmtDate, fmtMoney, toISODate, nextDueFrom, parseLocalDate } from '../lib/dates'
import { segmentOf } from '../lib/segments'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "Mon, Jul 27" — the header for one day's group of appointments.
function fmtDayHeading(iso) {
  const d = parseLocalDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// "123 Sunray Dr, Sacramento" — enough to know where you're driving.
function shortAddress(c) {
  if (!c) return ''
  return [c.street_address, c.city].filter(Boolean).join(', ')
}

function relativeLabel(iso) {
  const n = daysUntil(iso)
  if (n == null) return ''
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n < 0) return `${Math.abs(n)} days ago`
  return `in ${n} days`
}

export default function Schedule() {
  const { canEdit } = useAuth()
  const [customers, setCustomers] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('list')
  const [selectedDay, setSelectedDay] = useState(null)
  const [toast, setToast] = useState(null)
  const [busyId, setBusyId] = useState(null)

  // Month shown in the calendar grid — always the 1st of that month.
  const [monthCursor, setMonthCursor] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })

  function load() {
    return Promise.all([db.listCustomers(), db.listJobs()])
      .then(([c, j]) => { setCustomers(c); setJobs(j); setLoading(false) })
      .catch((e) => { setError(e.message || 'Could not load the schedule'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const byId = useMemo(() => {
    const m = {}
    for (const c of customers) m[c.id] = c
    return m
  }, [customers])

  // Booked appointments = jobs that are still "scheduled" and have a date.
  const appointments = useMemo(() => {
    return jobs
      .filter((j) => j.status === 'scheduled' && j.scheduled_date)
      .map((j) => ({ ...j, date: toISODate(j.scheduled_date), customer: byId[j.customer_id] }))
      .filter((j) => j.date)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [jobs, byId])

  const countsByDay = useMemo(() => {
    const m = {}
    for (const a of appointments) m[a.date] = (m[a.date] || 0) + 1
    return m
  }, [appointments])

  // Customers whose recurring cleaning is due but who have no appointment booked.
  const bookedCustomerIds = useMemo(
    () => new Set(appointments.map((a) => a.customer_id)), [appointments]
  )
  const dueUnbooked = useMemo(() => {
    return customers
      .filter((c) => c.next_service_due && !bookedCustomerIds.has(c.id))
      .map((c) => ({ ...c, d: daysUntil(c.next_service_due) }))
      .sort((a, b) => a.d - b.d)
  }, [customers, bookedCustomerIds])

  const noDate = useMemo(
    () => customers.filter((c) => !c.next_service_due && !bookedCustomerIds.has(c.id) && segmentOf(c) === 'customer'),
    [customers, bookedCustomerIds]
  )

  async function markDone(job) {
    setBusyId(job.id)
    try {
      const today = toISODate(new Date())
      await db.updateJob(job.id, { completed_date: today, status: 'completed' })
      const c = byId[job.customer_id]
      let next = null
      if (c) {
        next = nextDueFrom(new Date(), c.recurring_frequency)
        await db.updateCustomer(c.id, { next_service_due: next })
      }
      await load()
      setToast(next
        ? `Marked done. Next cleaning for ${c?.full_name || 'this customer'} auto-set for ${fmtDate(next)}.`
        : 'Marked done (one-time — no next cleaning scheduled).')
    } catch (e) {
      setToast(`Could not mark it done: ${e.message || 'unknown error'}`)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-rose-600">⚠️ {error}</p>

  const overdue = appointments.filter((a) => daysUntil(a.date) < 0)
  const today = appointments.filter((a) => daysUntil(a.date) === 0)
  const week = appointments.filter((a) => { const d = daysUntil(a.date); return d >= 1 && d <= 7 })
  const later = appointments.filter((a) => daysUntil(a.date) > 7)

  // ---- one appointment row -------------------------------------------------
  const Appt = ({ a }) => (
    <li className="py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Link to={`/customers/${a.customer_id}`} className="font-medium hover:text-brand-600 truncate block">
          {a.customer?.full_name || 'Unknown contact'}
        </Link>
        <div className="text-xs text-slate-500 truncate">
          {a.work_done || 'Cleaning'}
          {shortAddress(a.customer) ? ` · ${shortAddress(a.customer)}` : ''}
          {a.amount ? ` · ${fmtMoney(a.amount)}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {a.customer?.phone && (
          <a href={`tel:${a.customer.phone}`} className="btn-ghost !h-8 !px-2" title={`Call ${a.customer.phone}`}>
            <Phone size={14} />
          </a>
        )}
        {canEdit && (
          <button
            className="btn-ghost !h-8 !px-3 text-emerald-700"
            disabled={busyId === a.id}
            onClick={() => markDone(a)}
          >
            <CheckCircle2 size={14} /> {busyId === a.id ? 'Saving…' : 'Done'}
          </button>
        )}
      </div>
    </li>
  )

  // ---- a titled group of appointments, sub-grouped by day ------------------
  const Group = ({ title, rows, tone, emptyText }) => {
    const byDay = {}
    for (const a of rows) (byDay[a.date] ||= []).push(a)
    return (
      <div className="card p-5">
        <h2 className={`font-semibold mb-3 ${tone || ''}`}>
          {title} <span className="text-slate-400 font-normal">({rows.length})</span>
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyText || 'Nothing here.'}</p>
        ) : (
          Object.entries(byDay).map(([day, list]) => (
            <div key={day} className="mb-3 last:mb-0">
              <div className="flex items-baseline justify-between border-b border-slate-100 pb-1">
                <span className="text-sm font-semibold text-slate-700">{fmtDayHeading(day)}</span>
                <span className="text-xs text-slate-400">{relativeLabel(day)}</span>
              </div>
              <ul className="divide-y divide-slate-100 text-sm">
                {list.map((a) => <Appt key={a.id} a={a} />)}
              </ul>
            </div>
          ))
        )}
      </div>
    )
  }

  // ---- month grid ----------------------------------------------------------
  function MonthGrid() {
    const year = monthCursor.getFullYear()
    const month = monthCursor.getMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lead = first.getDay()
    const cells = []
    for (let i = 0; i < lead; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)

    const todayISO = toISODate(new Date())

    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <button className="btn-ghost !h-9 !px-3" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </button>
          <h2 className="font-semibold">
            {first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn-ghost !h-9 !px-3" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`x${i}`} className="h-16 rounded-lg" />
            const iso = toISODate(d)
            const n = countsByDay[iso] || 0
            const isToday = iso === todayISO
            const isSel = iso === selectedDay
            return (
              <button
                key={iso}
                onClick={() => setSelectedDay(isSel ? null : iso)}
                className={[
                  'h-16 rounded-lg border text-left p-1.5 transition',
                  isSel ? 'border-brand-600 ring-2 ring-brand-600/25 bg-brand-50'
                    : isToday ? 'border-brand-300 bg-brand-50/40'
                      : 'border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className={`text-xs font-semibold ${isToday ? 'text-brand-700' : 'text-slate-600'}`}>
                  {d.getDate()}
                </div>
                {n > 0 && (
                  <div className="mt-1 inline-flex items-center rounded-full bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5">
                    {n} {n === 1 ? 'job' : 'jobs'}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Tap a day to see just that day's cleanings. Tap it again to clear.
        </p>
      </div>
    )
  }

  const selected = selectedDay ? appointments.filter((a) => a.date === selectedDay) : []

  return (
    <div className="space-y-4">
      {toast && (
        <div className="card p-3 flex items-center justify-between gap-3 border-emerald-200 bg-emerald-50">
          <span className="text-sm text-emerald-900">{toast}</span>
          <button className="text-emerald-700 hover:text-emerald-900" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Schedule</h1>
        <div className="flex gap-2">
          <button
            className={view === 'list' ? 'btn-primary !h-9' : 'btn-ghost !h-9'}
            onClick={() => { setView('list'); setSelectedDay(null) }}
          >
            <ListIcon size={16} /> List
          </button>
          <button
            className={view === 'month' ? 'btn-primary !h-9' : 'btn-ghost !h-9'}
            onClick={() => setView('month')}
          >
            <CalendarDays size={16} /> Month
          </button>
        </div>
      </div>

      {/* At-a-glance counts */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-2xl font-bold leading-none text-rose-600">{overdue.length}</div>
          <div className="text-xs text-slate-500 mt-1">Past due</div>
        </div>
        <div className="card p-3">
          <div className="text-2xl font-bold leading-none text-brand-700">{today.length}</div>
          <div className="text-xs text-slate-500 mt-1">Today</div>
        </div>
        <div className="card p-3">
          <div className="text-2xl font-bold leading-none">{week.length}</div>
          <div className="text-xs text-slate-500 mt-1">Next 7 days</div>
        </div>
      </div>

      {view === 'month' && <MonthGrid />}

      {view === 'month' && selectedDay && (
        <Group
          title={fmtDayHeading(selectedDay)}
          rows={selected}
          emptyText="No cleanings booked for this day."
        />
      )}

      {(view === 'list' || !selectedDay) && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Group title="Past due" rows={overdue} tone="text-rose-600" emptyText="Nothing past due. 🎉" />
          <Group title="Today" rows={today} tone="text-brand-700" emptyText="No cleanings booked for today." />
          <Group title="Next 7 days" rows={week} emptyText="Nothing booked this week yet." />
          <Group title="Later" rows={later} emptyText="Nothing booked further out." />
        </div>
      )}

      {/* Recurring cleanings that are due but not yet on the calendar */}
      <div className="card p-5">
        <h2 className="font-semibold mb-1">Due for a cleaning — not booked yet</h2>
        <p className="text-xs text-slate-500 mb-3">
          These customers have a "next cleaning" date but no appointment on the calendar. Open one and press <strong>Book it</strong> to put them on a day.
        </p>
        {dueUnbooked.length === 0 ? (
          <p className="text-sm text-slate-400">Everyone due is already booked. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {dueUnbooked.slice(0, 50).map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-600 truncate">
                  {c.full_name}
                </Link>
                <span className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs ${c.d < 0 ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                    {c.d < 0 ? `${Math.abs(c.d)}d overdue` : relativeLabel(c.next_service_due)}
                  </span>
                  <span className="text-slate-500 w-24 text-right hidden sm:block">{fmtDate(c.next_service_due)}</span>
                  <Link to={`/customers/${c.id}`} className="btn-ghost !h-8 !px-3">
                    <CalendarPlus size={14} /> Book
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
        {dueUnbooked.length > 50 && (
          <p className="text-xs text-slate-400 mt-2">Showing the 50 most urgent of {dueUnbooked.length}.</p>
        )}
      </div>

      {noDate.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Customers with no cleaning date</h2>
          <p className="text-xs text-slate-500 mb-3">Customers who aren't on the calendar and have no next-cleaning date set.</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {noDate.slice(0, 50).map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link to={`/customers/${c.id}`} className="font-medium hover:text-brand-600 truncate">{c.full_name}</Link>
                <Link to={`/customers/${c.id}`} className="btn-ghost !h-8 !px-3 shrink-0">
                  <CalendarPlus size={14} /> Book
                </Link>
              </li>
            ))}
          </ul>
          {noDate.length > 50 && (
            <p className="text-xs text-slate-400 mt-2">Showing 50 of {noDate.length}.</p>
          )}
        </div>
      )}
    </div>
  )
}
