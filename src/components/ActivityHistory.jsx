import { useEffect, useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ChevronsUpDown, X, FileText } from 'lucide-react'
import { ACTIVITY_KINDS, buildActivity } from '../lib/activity'
import { fmtMoney } from '../lib/dates'

const fmtWhen = (row) => {
  if (!row.at) return '—'
  const d = new Date(row.ts)
  if (isNaN(d)) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + (row.showTime ? ` · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '')
}

// Columns you can sort on, the way you'd click a header in Excel.
const COLUMNS = [
  { key: 'ts', label: 'Date', sort: (r) => r.ts, className: 'w-36' },
  { key: 'kind', label: 'Type', sort: (r) => ACTIVITY_KINDS[r.kind]?.label || r.kind, className: 'w-28' },
  { key: 'outcome', label: 'Outcome', sort: (r) => r.outcome || '' },
  { key: 'detail', label: 'Details', sort: (r) => r.detail || '', className: 'hidden md:table-cell' },
  { key: 'amount', label: 'Amount', sort: (r) => (r.amount == null ? -1 : r.amount), align: 'right', className: 'w-28' },
  { key: 'note', label: 'Note', sort: (r) => (r.note || '').toLowerCase(), className: 'hidden lg:table-cell' },
]

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'call', label: 'Calls' },
  { key: 'service', label: 'Services' },
]

function AnsweredTag({ answered }) {
  if (answered === null || answered === undefined) return null
  return answered
    ? <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-semibold">Answered</span>
    : <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-semibold">No answer</span>
}

// Everything that happened to one contact, in a single sortable table: calls
// (and whether they picked up) and cleanings, with what each one was worth.
// Invoices and receipts live in their own card — they are documents, not events.
export default function ActivityHistory({ calls, jobs, canEdit, onMarkDone, onCancelJob }) {
  const [sortKey, setSortKey] = useState('ts')
  const [dir, setDir] = useState('desc')       // newest first, like the paper log
  const [filter, setFilter] = useState('all')
  const [openNote, setOpenNote] = useState(null)

  const all = useMemo(() => buildActivity({ calls, jobs }), [calls, jobs])

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0]
    const sign = dir === 'asc' ? 1 : -1
    return all
      .filter((r) => filter === 'all' || r.kind === filter)
      .slice()
      .sort((a, b) => {
        const x = col.sort(a), y = col.sort(b)
        const cmp = typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y))
        // Ties fall back to newest-first so the order never looks random.
        return cmp !== 0 ? cmp * sign : b.ts - a.ts
      })
  }, [all, sortKey, dir, filter])

  function toggleSort(key) {
    if (key === sortKey) { setDir(dir === 'asc' ? 'desc' : 'asc'); return }
    setSortKey(key)
    setDir(key === 'ts' || key === 'amount' ? 'desc' : 'asc')
  }

  // Esc closes the note popup.
  useEffect(() => {
    if (!openNote) return
    const onKey = (e) => { if (e.key === 'Escape') setOpenNote(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNote])

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold">History</h2>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filter === f.key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key
                const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}>
                    <button onClick={() => toggleSort(col.key)}
                      title="Click to sort. Click again to reverse."
                      className={`inline-flex items-center gap-1 hover:text-slate-700 ${active ? 'text-slate-800' : ''} ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                      {col.label} <Icon size={12} className={active ? '' : 'opacity-40'} />
                    </button>
                  </th>
                )
              })}
              {canEdit && <th className="px-3 py-2 text-right"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const kind = ACTIVITY_KINDS[r.kind]
              return (
                <tr key={r.id} className={`align-top hover:bg-slate-50 ${r.upcoming ? 'bg-blue-50/60' : ''}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{fmtWhen(r)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kind.color}`}>{kind.label}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`font-medium ${
                        r.upcoming ? 'text-blue-800' : r.pastDue ? 'text-amber-700' : 'text-slate-800'
                      }`}>{r.outcome}</span>
                      <AnsweredTag answered={r.answered} />
                    </div>
                    {r.detail && <div className="md:hidden text-xs text-slate-500 mt-0.5">{r.detail}</div>}
                    {/* On a phone the Note column is hidden — tap here instead. */}
                    {r.note && (
                      <button onClick={() => setOpenNote(r)}
                        className="lg:hidden mt-1 text-xs font-semibold text-brand-700 hover:underline inline-flex items-center gap-1">
                        <FileText size={12} /> Read note
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-slate-600">{r.detail || '—'}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {r.amount == null ? <span className="text-slate-300">—</span> : (
                      <>
                        <span className="font-semibold text-slate-800">{fmtMoney(r.amount)}</span>
                        {r.amountLabel && <div className="text-[11px] text-slate-400">{r.amountLabel}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell max-w-[11rem]">
                    {r.note ? (
                      <button onClick={() => setOpenNote(r)}
                        className="text-left text-brand-700 hover:underline inline-flex items-start gap-1">
                        <FileText size={13} className="mt-0.5 shrink-0" />
                        <span className="truncate block max-w-[9rem]">{r.note}</span>
                      </button>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.kind === 'service' && r.source.status === 'scheduled' && (
                        <span className="inline-flex gap-2">
                          {onMarkDone && (
                            <button className="text-xs font-semibold text-emerald-700 hover:underline"
                              onClick={() => onMarkDone(r.source)}>Mark done</button>
                          )}
                          {onCancelJob && (
                            <button className="text-xs font-semibold text-slate-500 hover:underline"
                              onClick={() => onCancelJob(r.source)}>Cancel</button>
                          )}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={canEdit ? 7 : 6} className="px-3 py-8 text-center text-slate-400">
                Nothing logged yet. Calls and cleanings show up here.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Full note */}
      {openNote && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={() => setOpenNote(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative card p-5 w-full max-w-lg max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">{ACTIVITY_KINDS[openNote.kind].label} note</div>
                <div className="text-xs text-slate-500">
                  {fmtWhen(openNote)} · {openNote.outcome}
                </div>
              </div>
              <button onClick={() => setOpenNote(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{openNote.note}</p>
          </div>
        </div>
      )}
    </div>
  )
}
