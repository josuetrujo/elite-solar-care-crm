import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../data'
import { SEGMENTS, SEGMENT_ORDER } from '../lib/config'
import ContactList from '../components/ContactList'

// One list holds every contact. The chips below only filter it — nobody lives
// in a separate table, so a lead who says "do not call" just changes label.
const CHIPS = [
  { key: 'all', label: 'All contacts', color: 'bg-slate-800 text-white' },
  ...SEGMENT_ORDER.map((key) => ({ key, label: SEGMENTS[key].label, color: SEGMENTS[key].color })),
]

export default function Contacts() {
  const [params, setParams] = useSearchParams()
  const wanted = params.get('class') || 'all'
  const segment = CHIPS.some((c) => c.key === wanted) ? wanted : 'all'
  const [counts, setCounts] = useState(null)

  // Counts refresh whenever the tab changes, so they follow a contact that
  // was just reclassified on the detail page.
  useEffect(() => {
    let live = true
    db.countCustomersBySegment().then((c) => { if (live) setCounts(c) }).catch(() => {})
    return () => { live = false }
  }, [segment])

  const pick = (key) => setParams(key === 'all' ? {} : { class: key }, { replace: true })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Contacts</h1>
        <p className="text-sm text-slate-500">
          Everyone in one list. Pick a type to narrow it down — outcomes you log on a call
          move contacts between types by themselves.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CHIPS.map((c) => {
          const active = segment === c.key
          const n = counts?.[c.key]
          return (
            <button key={c.key} onClick={() => pick(c.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                active ? 'bg-brand-600 border-brand-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              {c.label}
              {n != null && (
                <span className={`ml-2 text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>
                  {n.toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ContactList segment={segment} allowAdd />
    </div>
  )
}
