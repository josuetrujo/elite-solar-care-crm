import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Calculator, Bell, CalendarPlus, CheckCircle2, X, Printer, Receipt } from 'lucide-react'
import { db } from '../data'
import { PIPELINE, RECURRING_OPTIONS, PAYMENT_METHODS, INVOICE_STATUSES } from '../lib/config'
import { estimateQuote } from '../lib/pricing'
import { nextDueFrom, fmtDate, fmtMoney, toISODate } from '../lib/dates'
import { openReceipt, receiptNumber } from '../lib/receipt'
import { remindersEnabled, smsEnabled, emailEnabled, sendReminder } from '../lib/notifications'
import { segmentOf } from '../lib/segments'
import { SEGMENTS } from '../lib/config'
import DispositionBar from '../components/DispositionBar'
import CallHistory from '../components/CallHistory'
import JobPhotos from '../components/JobPhotos'
import { useAuth } from '../context/AuthContext'

const FIELD = (label, node) => (
  <div><label className="label">{label}</label>{node}</div>
)

// Which list a segment lives in, for "moved to…" links.
function segRoute(seg) {
  if (seg === 'customer') return '/customers'
  if (seg === 'lead') return '/leads'
  return '/lists' // dnc, lost, bad_number
}

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit, isAdmin } = useAuth()
  const [c, setC] = useState(null)
  const [jobs, setJobs] = useState([])
  const [calls, setCalls] = useState([])
  const [saved, setSaved] = useState(false)
  const [miles, setMiles] = useState(0)
  const [toast, setToast] = useState(null)
  const [schedDate, setSchedDate] = useState(toISODate(new Date()))
  const [invoices, setInvoices] = useState([])
  const [invDraft, setInvDraft] = useState(null) // null = form closed
  const origSeg = useRef(null)

  function reload() {
    db.getCustomer(id).then((x) => { setC(x); origSeg.current = segmentOf(x) })
    db.listJobs(id).then(setJobs)
    db.listCalls(id).then(setCalls)
    db.listInvoices(id).then(setInvoices).catch(() => setInvoices([]))
  }
  useEffect(() => { reload() }, [id])

  if (!c) return <p className="text-slate-400">Loading…</p>

  const seg = SEGMENTS[segmentOf(c)]

  const set = (k, v) => { setC({ ...c, [k]: v }); setSaved(false) }

  async function save() {
    // Only send the fields this page actually edits. Sending the whole row back
    // would overwrite call-tracking columns with whatever they were when the
    // page loaded — quietly undoing a call logged from another tab or phone.
    const EDITABLE = [
      'first_name', 'last_name', 'email', 'phone', 'street_address', 'city', 'state', 'zip',
      'property_type', 'panel_count', 'stories', 'roof_type', 'lead_source', 'status',
      'quoted_amount', 'recurring_frequency', 'next_service_due',
      'consent_sms', 'consent_email', 'do_not_call', 'bad_number', 'notes',
    ]
    const patch = {}
    for (const k of EDITABLE) if (k in c) patch[k] = c[k]
    if (c.first_name || c.last_name) patch.full_name = [c.first_name, c.last_name].filter(Boolean).join(' ')
    await db.updateCustomer(id, patch)
    setSaved(true)
    const newSeg = segmentOf(c)
    if (origSeg.current && newSeg !== origSeg.current) {
      const info = SEGMENTS[newSeg]
      setToast({ msg: `Saved — this contact is now in ${info.label}.`, to: segRoute(newSeg), label: `View ${info.label}` })
      origSeg.current = newSeg
    } else {
      setToast({ msg: 'Saved.' })
    }
  }
  async function remove() {
    if (!confirm('Delete this customer? This cannot be undone.')) return
    await db.deleteCustomer(id)
    navigate('/customers')
  }

  const quote = estimateQuote({
    panelCount: c.panel_count, stories: c.stories, miles,
    nonShingleRoof: c.roof_type && !c.roof_type.trim().toLowerCase().startsWith('shingle'),
    firstTime: c.status === 'new_lead' || c.status === 'quoted',
  })

  async function scheduleNext() {
    const due = nextDueFrom(new Date(), c.recurring_frequency)
    set('next_service_due', due)
    await db.updateCustomer(id, { next_service_due: due })
    setSaved(true)
  }

  // Book a cleaning for a chosen date: creates a scheduled job + sets next-due to that date.
  // If they were still a lead, booking makes them a customer (out of the call queue).
  async function bookCleaning() {
    if (!schedDate) return
    const job = await db.createJob({
      customer_id: id, scheduled_date: schedDate,
      work_done: 'Cleaning', amount: c.quoted_amount ?? quote.total, status: 'scheduled',
    })
    const patch = { next_service_due: schedDate }
    const wasLead = segmentOf(c) === 'lead'
    if (wasLead) patch.status = 'scheduled'
    await db.updateCustomer(id, patch)
    setJobs([job, ...jobs])
    setC({ ...c, ...patch })
    if (wasLead) origSeg.current = 'customer'
    setToast({
      msg: `Cleaning booked for ${fmtDate(schedDate)}.${wasLead ? ' This contact is now a Customer.' : ''}`,
      to: '/schedule', label: 'View Schedule',
    })
  }

  // Mark a scheduled cleaning complete → auto-set the next recurring cleaning
  // (or clear it for one-time) AND raise the invoice so a receipt is one click away.
  async function markDone(j) {
    const today = toISODate(new Date())
    await db.updateJob(j.id, { completed_date: today, status: 'completed' })
    const next = nextDueFrom(new Date(), c.recurring_frequency)
    await db.updateCustomer(id, { next_service_due: next })

    let madeInvoice = false
    const amount = Number(j.amount ?? c.quoted_amount ?? 0)
    if (amount > 0) {
      try {
        await db.createInvoice({
          customer_id: id, job_id: j.id, amount,
          description: j.work_done || 'Solar Panel Cleaning',
          status: 'unpaid',
        })
        madeInvoice = true
      } catch (_) { /* invoice is a bonus — never block completing the job */ }
    }

    reload()
    setToast({
      msg: [
        'Marked done.',
        next ? `Next cleaning auto-set for ${fmtDate(next)}.` : 'One-time job — no next cleaning set.',
        madeInvoice ? `Invoice for ${fmtMoney(amount)} created below.` : '',
      ].filter(Boolean).join(' '),
      to: '/schedule', label: 'View Schedule',
    })
  }

  // ---- invoices / receipts -------------------------------------------------
  function openInvoiceForm() {
    setInvDraft({
      amount: c.quoted_amount ?? quote.total ?? '',
      description: 'Solar Panel Cleaning',
      payment_method: 'cash',
      check_no: '',
      discount: 0,
      tax: 0,
      notes: 'Payment received in full — thank you for your business!',
      markPaid: true,
    })
  }

  async function saveInvoice() {
    const d = invDraft
    const amount = Number(d.amount)
    if (!amount || amount <= 0) { setToast({ msg: 'Enter an amount greater than $0 first.' }); return }
    const row = {
      customer_id: id,
      amount,
      description: d.description || 'Solar Panel Cleaning',
      payment_method: d.payment_method || null,
      check_no: d.payment_method === 'check' ? (d.check_no || null) : null,
      discount: Number(d.discount) || 0,
      tax: Number(d.tax) || 0,
      notes: d.notes || null,
      status: d.markPaid ? 'paid' : 'unpaid',
      paid_date: d.markPaid ? toISODate(new Date()) : null,
    }
    try {
      const saved = await db.createInvoice(row)
      setInvoices([saved, ...invoices])
      setInvDraft(null)
      setToast({ msg: `${receiptNumber(saved)} created. Press Receipt to save or print it.`, to: '/invoices', label: 'All invoices' })
    } catch (e) {
      setToast({ msg: `Could not create the invoice: ${e.message}` })
    }
  }

  async function markInvoicePaid(inv) {
    try {
      const saved = await db.updateInvoice(inv.id, { status: 'paid', paid_date: toISODate(new Date()) })
      setInvoices(invoices.map((i) => (i.id === inv.id ? saved : i)))
      setToast({ msg: `${receiptNumber(inv)} marked paid.` })
    } catch (e) { setToast({ msg: `Could not update it: ${e.message}` }) }
  }

  function printReceipt(inv) {
    const ok = openReceipt({ invoice: inv, customer: c })
    if (!ok) setToast({ msg: 'Your browser blocked the receipt window. Allow pop-ups for this site, then try again.' })
  }

  async function notify(channel) {
    try {
      const res = await sendReminder({ customer: c, kind: 'service_due', channel })
      setToast({ msg: `Reminder sent by ${res?.channel === 'email' ? 'email' : 'text'} to ${res?.to || 'the customer'}.` })
    } catch (e) {
      setToast({ msg: `Not sent — ${e.message}` })
    }
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link to="/customers" className="btn-ghost"><ArrowLeft size={16} /> Back</Link>
        {canEdit && (
          <div className="flex gap-2">
            {isAdmin && <button className="btn-danger" onClick={remove}><Trash2 size={16} /> Delete</button>}
            <button className="btn-primary" onClick={save}><Save size={16} /> {saved ? 'Saved ✓' : 'Save'}</button>
          </div>
        )}
      </div>

      {toast && (
        <div className="card p-3 bg-emerald-50 border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} /> {toast.msg}</span>
          <span className="flex items-center gap-3 shrink-0">
            {toast.to && <Link to={toast.to} className="font-semibold underline">{toast.label}</Link>}
            <button onClick={() => setToast(null)} className="text-emerald-700"><X size={14} /></button>
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{c.full_name || 'New Customer'}</h1>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${seg.color}`}>{seg.label}</span>
        {c.phone && <a href={`tel:${c.phone}`} className="text-sm text-brand-600 hover:underline">📞 {c.phone}</a>}
      </div>

      {/* Calling: log this call */}
      {canEdit && (
        <div className="card p-5 border-brand-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Log a call</h2>
            {c.call_attempts > 0 && <span className="text-xs text-slate-400">{c.call_attempts} attempt{c.call_attempts === 1 ? '' : 's'}</span>}
          </div>
          <DispositionBar customer={c} onDone={reload} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Contact */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Contact</h2>
          <div className="grid grid-cols-2 gap-3">
            {FIELD('First name', <input className="input" value={c.first_name || ''} onChange={(e) => set('first_name', e.target.value)} />)}
            {FIELD('Last name', <input className="input" value={c.last_name || ''} onChange={(e) => set('last_name', e.target.value)} />)}
          </div>
          {FIELD('Email', <input className="input" value={c.email || ''} onChange={(e) => set('email', e.target.value)} />)}
          {FIELD('Phone', <input className="input" value={c.phone || ''} onChange={(e) => set('phone', e.target.value)} />)}
          {FIELD('Street address', <input className="input" value={c.street_address || ''} onChange={(e) => set('street_address', e.target.value)} />)}
          <div className="grid grid-cols-3 gap-3">
            {FIELD('City', <input className="input" value={c.city || ''} onChange={(e) => set('city', e.target.value)} />)}
            {FIELD('State', <input className="input" value={c.state || ''} onChange={(e) => set('state', e.target.value)} />)}
            {FIELD('Zip', <input className="input" value={c.zip || ''} onChange={(e) => set('zip', e.target.value)} />)}
          </div>
        </div>

        {/* System + pipeline */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">System & Pipeline</h2>
          <div className="grid grid-cols-2 gap-3">
            {FIELD('Status', (
              <select className="input" value={c.status} onChange={(e) => set('status', e.target.value)}>
                {PIPELINE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            ))}
            {FIELD('Property', (
              <select className="input" value={c.property_type || 'residential'} onChange={(e) => set('property_type', e.target.value)}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            ))}
            {FIELD('Panel count', <input type="number" className="input" value={c.panel_count ?? ''} onChange={(e) => set('panel_count', e.target.value === '' ? null : Number(e.target.value))} />)}
            {FIELD('Stories', <input type="number" className="input" value={c.stories ?? ''} onChange={(e) => set('stories', e.target.value === '' ? null : Number(e.target.value))} />)}
            {FIELD('Roof type', <input className="input" value={c.roof_type || ''} placeholder="shingle, tile, flat…" onChange={(e) => set('roof_type', e.target.value)} />)}
            {FIELD('Quoted amount', <input type="number" className="input" value={c.quoted_amount ?? ''} onChange={(e) => set('quoted_amount', e.target.value === '' ? null : Number(e.target.value))} />)}
            {FIELD('Lead source', <input className="input" value={c.lead_source || ''} onChange={(e) => set('lead_source', e.target.value)} />)}
            {FIELD('Recurring', (
              <select className="input" value={c.recurring_frequency || 'twice_a_year'} onChange={(e) => set('recurring_frequency', e.target.value)}>
                {RECURRING_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* Quote calculator */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Calculator size={16} /> Quote estimate</h2>
          <p className="text-xs text-slate-500">From your price list ($8/panel, $50/story, $0.54/mi, +$100 non-shingle, +$100 first-time).</p>
          {FIELD('Travel distance (miles)', <input type="number" className="input" value={miles} onChange={(e) => setMiles(Number(e.target.value) || 0)} />)}
          <ul className="text-sm text-slate-600 space-y-1">
            {quote.lines.map((l, i) => (
              <li key={i} className="flex justify-between"><span>{l.label}</span><span>{fmtMoney(l.amount)}</span></li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-semibold">Estimated total</span>
            <span className="font-bold text-brand-700">{fmtMoney(quote.total)}</span>
          </div>
          {canEdit && <button className="btn-ghost w-full justify-center" onClick={() => set('quoted_amount', quote.total)}>Use as quoted amount</button>}
        </div>

        {/* Scheduling & reminders */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Schedule a cleaning</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Next cleaning</span>
            <span className="font-medium">{fmtDate(c.next_service_due)}</span>
          </div>
          {canEdit && (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="label">Pick a date</label>
                  <input type="date" className="input" value={schedDate || ''} onChange={(e) => setSchedDate(e.target.value)} />
                </div>
                <button className="btn-primary shrink-0" onClick={bookCleaning}><CalendarPlus size={16} /> Book it</button>
              </div>
              <button className="text-xs text-brand-600 hover:underline" onClick={scheduleNext}>
                Or auto-set next due ({RECURRING_OPTIONS.find(o => o.key === (c.recurring_frequency || 'twice_a_year'))?.label})
              </button>
            </>
          )}
          <div className="flex gap-4 text-sm pt-2 border-t">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.consent_sms} onChange={(e) => set('consent_sms', e.target.checked)} /> SMS consent</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.consent_email} onChange={(e) => set('consent_email', e.target.checked)} /> Email consent</label>
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.do_not_call} onChange={(e) => set('do_not_call', e.target.checked)} /> Do&nbsp;Not&nbsp;Call</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!c.bad_number} onChange={(e) => set('bad_number', e.target.checked)} /> Bad&nbsp;number</label>
          </div>
          <p className="text-xs text-slate-400">Uncheck and Save to move a contact back onto the call list.</p>
          {remindersEnabled() ? (
            <div className="flex gap-2">
              {smsEnabled() && (
                <button
                  className="btn-ghost flex-1 justify-center"
                  disabled={!c.consent_sms || !c.phone}
                  title={!c.consent_sms ? 'Tick SMS consent first' : !c.phone ? 'No phone number on file' : ''}
                  onClick={() => notify('sms')}
                >
                  <Bell size={16} /> Text reminder
                </button>
              )}
              {emailEnabled() && (
                <button
                  className="btn-ghost flex-1 justify-center"
                  disabled={!c.consent_email || !c.email}
                  title={!c.consent_email ? 'Tick email consent first' : !c.email ? 'No email address on file' : ''}
                  onClick={() => notify('email')}
                >
                  <Bell size={16} /> Email reminder
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Reminders are off until you add Twilio/Resend keys. Consent is tracked now so you're ready.</p>
          )}
        </div>
      </div>

      {/* Call history */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Call history</h2>
        <CallHistory calls={calls} />
      </div>

      {/* Service history */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Service history</h2>
        {jobs.length === 0 ? <p className="text-sm text-slate-400">No jobs logged yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="py-2 flex items-center justify-between gap-2">
                <span>{fmtDate(j.completed_date || j.scheduled_date)} · {j.work_done || 'Service'}</span>
                <span className="flex items-center gap-3 text-slate-600 shrink-0">
                  <span>{fmtMoney(j.amount)} · {j.status}</span>
                  {canEdit && j.status === 'scheduled' && (
                    <button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => markDone(j)}>Mark done</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Photos */}
      <JobPhotos customerId={id} jobs={jobs} />

      {/* Invoices & receipts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2"><Receipt size={16} /> Invoices &amp; receipts</h2>
          {canEdit && !invDraft && (
            <button className="btn-ghost !h-9" onClick={openInvoiceForm}>New invoice</button>
          )}
        </div>

        {invDraft && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 mb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              {FIELD('Amount charged', (
                <input type="number" className="input" value={invDraft.amount}
                  onChange={(e) => setInvDraft({ ...invDraft, amount: e.target.value })} />
              ))}
              {FIELD('What was done', (
                <input className="input" value={invDraft.description}
                  onChange={(e) => setInvDraft({ ...invDraft, description: e.target.value })} />
              ))}
              {FIELD('Paid with', (
                <select className="input" value={invDraft.payment_method}
                  onChange={(e) => setInvDraft({ ...invDraft, payment_method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              ))}
              {invDraft.payment_method === 'check'
                ? FIELD('Check number', (
                  <input className="input" value={invDraft.check_no}
                    onChange={(e) => setInvDraft({ ...invDraft, check_no: e.target.value })} />
                ))
                : FIELD('Discount', (
                  <input type="number" className="input" value={invDraft.discount}
                    onChange={(e) => setInvDraft({ ...invDraft, discount: e.target.value })} />
                ))}
            </div>
            {FIELD('Note on the receipt', (
              <input className="input" value={invDraft.notes}
                onChange={(e) => setInvDraft({ ...invDraft, notes: e.target.value })} />
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={invDraft.markPaid}
                onChange={(e) => setInvDraft({ ...invDraft, markPaid: e.target.checked })} />
              Already paid (prints as "Paid in full")
            </label>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveInvoice}>Create invoice</button>
              <button className="btn-ghost" onClick={() => setInvDraft(null)}>Cancel</button>
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <p className="text-sm text-slate-400">
            No invoices yet. Press <strong>New invoice</strong> after a cleaning, or use <strong>Mark done</strong>
            {' '}on a booked cleaning above and one is created automatically.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {invoices.map((inv) => {
              const si = INVOICE_STATUSES.find((s) => s.key === inv.status) || INVOICE_STATUSES[0]
              return (
                <li key={inv.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">{receiptNumber(inv)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${si.color}`}>{si.label}</span>
                    <span className="text-slate-500 truncate">{fmtDate(inv.paid_date || inv.created_at)}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-bold">{fmtMoney(inv.amount)}</span>
                    <button className="btn-ghost !h-8 !px-3" onClick={() => printReceipt(inv)}>
                      <Printer size={14} /> Receipt
                    </button>
                    {canEdit && inv.status !== 'paid' && (
                      <button className="btn-ghost !h-8 !px-3 text-emerald-700" onClick={() => markInvoicePaid(inv)}>
                        <CheckCircle2 size={14} /> Paid
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Notes */}
      <div className="card p-5">
        <label className="label">Notes</label>
        <textarea className="input min-h-[90px]" value={c.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </div>
    </div>
  )
}
