import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, SkipForward, RotateCcw, ExternalLink, PartyPopper, MapPin, Sun } from 'lucide-react'
import { db } from '../data'
import { segmentOf } from '../lib/segments'
import { fmtDate } from '../lib/dates'
import { dispositionLabel } from '../lib/config'
import { useAuth } from '../context/AuthContext'
import DispositionBar from '../components/DispositionBar'

// Build the call queue from the leads, in priority order:
//   1) callbacks due (callback_at <= end of today), earliest first
//   2) never called
//   3) everyone else: fewest attempts, then oldest last-call first
function buildQueue(customers) {
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)
  // Leads only — and don't serve someone whose callback is promised for a future day.
  const leads = customers.filter((c) =>
    segmentOf(c) === 'lead' && !(c.callback_at && new Date(c.callback_at) > endToday))
  const bucket = (c) => {
    if (c.callback_at && new Date(c.callback_at) <= endToday) return 0
    if (!c.call_attempts) return 1
    return 2
  }
  return leads.sort((a, b) => {
    const ba = bucket(a), bb = bucket(b)
    if (ba !== bb) return ba - bb
    if (ba === 0) return new Date(a.callback_at) - new Date(b.callback_at)
    if (ba === 2) {
      if ((a.call_attempts || 0) !== (b.call_attempts || 0)) return (a.call_attempts || 0) - (b.call_attempts || 0)
      return new Date(a.last_call_at || 0) - new Date(b.last_call_at || 0)
    }
    return 0
  })
}

export default function CallMode() {
  const { canEdit } = useAuth()
  const [queue, setQueue] = useState([])
  const [i, setI] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function load() {
    setLoading(true)
    db.listCustomers()
      .then((c) => { setQueue(buildQueue(c)); setI(0); setLoading(false) })
      .catch((e) => { setError(e.message || 'Could not load leads'); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const current = queue[i]
  const advance = () => setI((n) => n + 1)

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-rose-600">⚠️ {error}</p>

  if (!canEdit) {
    return <p className="text-slate-500">Call Mode is for users who can log calls (admin or member).</p>
  }

  if (queue.length === 0 || i >= queue.length) {
    return (
      <div className="max-w-md mx-auto text-center mt-12 space-y-4">
        <PartyPopper className="mx-auto text-brand-600" size={40} />
        <h1 className="text-xl font-bold">{queue.length === 0 ? 'No leads to call' : "That's the whole list!"}</h1>
        <p className="text-slate-500">
          {queue.length === 0
            ? 'Every lead has been handled, or there are none yet.'
            : `You worked through ${queue.length} lead${queue.length === 1 ? '' : 's'}. Nice.`}
        </p>
        <button className="btn-primary mx-auto" onClick={load}><RotateCcw size={16} /> Reload the list</button>
      </div>
    )
  }

  const c = current
  const seg = c.callback_at && new Date(c.callback_at) <= new Date(new Date().setHours(23,59,59,999))
    ? 'Callback due' : (c.call_attempts ? `Attempt ${(c.call_attempts || 0) + 1}` : 'New lead')

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-xl bg-brand-800 text-white px-5 py-3 flex items-center justify-between shadow-brand">
        <div className="flex items-center gap-2 font-display font-bold"><Phone size={18} /> Call Mode</div>
        <span className="text-sm text-brand-100">Lead {i + 1} of {queue.length}</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden -mt-2">
        <div className="h-full bg-brand-600 transition-all" style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>

      {/* Current lead card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="inline-block rounded-full bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 mb-1.5">{seg}</div>
            <h2 className="text-3xl font-display font-extrabold text-slate-900 leading-tight">{c.full_name || '(no name)'}</h2>
            {(c.street_address || c.city) && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin size={14} /> {[c.street_address, c.city, c.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <Link to={`/customers/${c.id}`} className="btn-ghost text-sm"><ExternalLink size={14} /> Profile</Link>
        </div>

        {/* Big call button */}
        {c.phone ? (
          <a href={`tel:${c.phone}`} className="flex items-center justify-center gap-3 w-full rounded-xl bg-brand-600 text-white py-3.5 shadow-brand hover:bg-brand-700 transition active:scale-[0.99]">
            <Phone size={22} />
            <span className="text-left leading-tight">
              <span className="block text-lg font-bold">{c.phone}</span>
              <span className="block text-xs text-brand-100">Tap to call</span>
            </span>
          </a>
        ) : (
          <div className="text-center text-sm text-rose-600 bg-rose-50 rounded-lg py-3">No phone number on file</div>
        )}

        {/* Quick facts */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          {c.panel_count != null && <span className="flex items-center gap-1"><Sun size={14} /> {c.panel_count} panels</span>}
          {c.callback_at && <span>Callback: {fmtDate(c.callback_at)}</span>}
          {c.last_disposition && <span>Last: {dispositionLabel(c.last_disposition)}</span>}
          {c.email && <span>{c.email}</span>}
        </div>

        {c.notes && (
          <div className="rounded-lg bg-amber-50 border-l-4 border-amber-400 p-3 text-sm text-slate-700">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700 mb-0.5">Last note</div>
            {c.notes}
          </div>
        )}
      </div>

      {/* Outcome buttons (auto-advance on log). key remounts on lead change to reset note/modal. */}
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Log the outcome</h3>
        <DispositionBar key={c.id} customer={c} onDone={advance} />
      </div>

      <div className="flex justify-center">
        <button className="btn-ghost" onClick={advance}><SkipForward size={16} /> Skip for now</button>
      </div>
    </div>
  )
}
