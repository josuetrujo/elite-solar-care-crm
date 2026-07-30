// One merged history for a contact: every call and every cleaning, flattened
// into rows a table can sort. Nothing is stored — this is built from the
// records already on the contact each time the page loads. (Invoices and
// receipts have their own card on the page; they are not history rows.)
import { dispositionLabel, dispositionAnswered } from './config'

export const ACTIVITY_KINDS = {
  call: { label: 'Call', color: 'bg-brand-50 text-brand-700' },
  service: { label: 'Service', color: 'bg-blue-100 text-blue-800' },
}

const JOB_STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  canceled: 'Canceled',
}

// Sortable timestamp. Dates stored as 'YYYY-MM-DD' get noon local time so a
// same-day call and a same-day cleaning don't flip order over a timezone hour.
function stamp(value) {
  if (!value) return 0
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d, 12).getTime()
  }
  const t = new Date(value).getTime()
  return isNaN(t) ? 0 : t
}

function daysAway(ts) {
  const day = 24 * 60 * 60 * 1000
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const n = Math.round((ts - start.getTime()) / day)
  if (n <= 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `in ${n} days`
}

export function buildActivity({ calls = [], jobs = [] } = {}) {
  const rows = []

  for (const c of calls) {
    rows.push({
      id: `call:${c.id}`,
      kind: 'call',
      source: c,
      at: c.called_at,
      ts: stamp(c.called_at),
      // Time matters on a call, so show it; a cleaning only needs the day.
      showTime: true,
      outcome: dispositionLabel(c.disposition),
      answered: dispositionAnswered(c.disposition),
      detail: c.callback_at ? `Call back ${new Date(c.callback_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })}` : '',
      amount: null,
      note: c.note || '',
    })
  }

  const now = Date.now()
  for (const j of jobs) {
    const done = j.status === 'completed'
    const when = j.completed_date || j.scheduled_date || j.created_at
    const ts = stamp(when)
    // A booked cleaning reads as "Upcoming" until its day arrives; after that
    // the same row turns into "Past due" until the outcome is logged. Nothing
    // is stored for this — it follows the calendar on its own.
    const upcoming = j.status === 'scheduled' && ts > now
    const pastDue = j.status === 'scheduled' && ts <= now
    rows.push({
      id: `job:${j.id}`,
      kind: 'service',
      source: j,
      at: when,
      ts,
      showTime: false,
      upcoming,
      pastDue,
      outcome: upcoming ? 'Upcoming' : pastDue ? 'Past due' : (JOB_STATUS_LABEL[j.status] || j.status || 'Scheduled'),
      answered: null,
      detail: [
        j.work_done || 'Solar panel cleaning',
        upcoming ? daysAway(ts) : pastDue ? 'Did this happen? Mark it done or cancel it.' : '',
        j.crew ? `crew: ${j.crew}` : '',
      ].filter(Boolean).join(' · '),
      // A finished job is what we charged; a booked one is still a quote.
      amount: j.amount == null ? null : Number(j.amount),
      amountLabel: done ? 'charged' : 'quoted',
      note: j.notes || '',
    })
  }

  return rows.sort((a, b) => b.ts - a.ts)
}
