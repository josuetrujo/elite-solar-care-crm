import { Phone } from 'lucide-react'
import { dispositionLabel } from '../lib/config'
import { fmtDate } from '../lib/dates'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CallHistory({ calls }) {
  if (!calls || calls.length === 0) return <p className="text-sm text-slate-400">No calls logged yet.</p>
  return (
    <ul className="space-y-3">
      {calls.map((c) => (
        <li key={c.id} className="flex gap-3">
          <div className="mt-0.5 rounded-full bg-brand-50 text-brand-600 p-1.5 h-7 w-7 flex items-center justify-center">
            <Phone size={14} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{dispositionLabel(c.disposition)}</span>
              <span className="text-xs text-slate-400">{fmtDateTime(c.called_at)}</span>
            </div>
            {c.callback_at && <div className="text-xs text-amber-700">Call back: {fmtDateTime(c.callback_at)}</div>}
            {c.note && <p className="text-sm text-slate-600">{c.note}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
