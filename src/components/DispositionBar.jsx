import { useState } from 'react'
import { DISPOSITIONS, RECURRING_OPTIONS } from '../lib/config'
import { logDisposition } from '../lib/calls'

// The row of call-outcome buttons. Handles Call Later (date/time) and Sale (form).
export default function DispositionBar({ customer, onDone }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null) // 'call_later' | 'sale' | null
  const [callbackAt, setCallbackAt] = useState('')
  const [sale, setSale] = useState({
    panel_count: customer.panel_count ?? '',
    quoted_amount: customer.quoted_amount ?? '',
    recurring_frequency: customer.recurring_frequency || 'twice_a_year',
    notes: '',
  })

  async function apply(key, extra = {}) {
    setBusy(true)
    try {
      const res = await logDisposition(customer, key, { note, ...extra })
      setNote('')
      setModal(null)
      // res.queued means there was no signal — it's saved on the phone and
      // will go up on its own. Either way the call was NOT lost, so move on.
      onDone && onDone(res)
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  function press(d) {
    if (d.key === 'call_later') { setModal('call_later'); return }
    if (d.key === 'sale') { setModal('sale'); return }
    if ((d.key === 'dnc' || d.key === 'bad_number') &&
        !confirm(`Mark ${customer.full_name || 'this contact'} as ${d.label}? They will leave the call list.`)) return
    apply(d.key)
  }

  return (
    <div className="space-y-3">
      <textarea className="input min-h-[64px]" placeholder="What happened on this call? (saved with the outcome)"
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DISPOSITIONS.filter((d) => d.key !== 'sale').map((d) => (
          <button key={d.key} disabled={busy} onClick={() => press(d)}
            className={`h-11 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-50 ${d.tone}`}>
            {d.label}
          </button>
        ))}
      </div>
      {DISPOSITIONS.filter((d) => d.key === 'sale').map((d) => (
        <button key={d.key} disabled={busy} onClick={() => press(d)}
          className="w-full h-12 rounded-xl bg-emerald-600 text-white font-bold text-base shadow-sm hover:bg-emerald-700 transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2">
          🎉 SALE
        </button>
      ))}

      {/* Call Later modal */}
      {modal === 'call_later' && (
        <Modal title="Schedule a call-back" onClose={() => setModal(null)}>
          <label className="label">Call back on</label>
          <input type="datetime-local" className="input" value={callbackAt} onChange={(e) => setCallbackAt(e.target.value)} />
          <div className="flex justify-end gap-2 pt-3">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" disabled={!callbackAt || busy}
              onClick={() => apply('call_later', { callbackAt: new Date(callbackAt).toISOString() })}>
              Save call-back
            </button>
          </div>
        </Modal>
      )}

      {/* Sale modal */}
      {modal === 'sale' && (
        <Modal title="🎉 Record a sale" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Panel count</label>
              <input type="number" className="input" value={sale.panel_count}
                onChange={(e) => setSale({ ...sale, panel_count: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
            <div><label className="label">Price ($)</label>
              <input type="number" className="input" value={sale.quoted_amount}
                onChange={(e) => setSale({ ...sale, quoted_amount: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
          </div>
          <label className="label mt-3">Cleaning subscription</label>
          <div className="grid grid-cols-2 gap-2">
            {RECURRING_OPTIONS.map((o) => (
              <button type="button" key={o.key} onClick={() => setSale({ ...sale, recurring_frequency: o.key })}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                  sale.recurring_frequency === o.key
                    ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <label className="label mt-3">Notes</label>
          <textarea className="input" value={sale.notes} onChange={(e) => setSale({ ...sale, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-3">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy}
              onClick={() => apply('sale', { sale: {
                panel_count: sale.panel_count === '' ? null : sale.panel_count,
                quoted_amount: sale.quoted_amount === '' ? null : sale.quoted_amount,
                recurring_frequency: sale.recurring_frequency,
                notes: sale.notes,
              } })}>
              ✓ Save &amp; next lead
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="card relative z-10 w-full max-w-md p-5">
        <h3 className="font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}
