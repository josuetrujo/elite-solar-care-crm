import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, Printer, Download, Mail, CheckCircle2, Trash2, Send, X, Search } from 'lucide-react'
import { db } from '../data'
import { useAuth } from '../context/AuthContext'
import { paymentsEnabled, createSquareInvoice } from '../lib/square'
import { openReceipt, downloadReceiptPdf, receiptNumber } from '../lib/receipt'
import { emailInvoice, invoiceEmailMode } from '../lib/invoiceEmail'
import { fmtDate, fmtMoney, toISODate } from '../lib/dates'
import { INVOICE_STATUSES } from '../lib/config'

const statusInfo = (k) => INVOICE_STATUSES.find((s) => s.key === k) || INVOICE_STATUSES[0]

export default function Invoices() {
  const { canEdit, isAdmin } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)

  function load() {
    return Promise.all([db.listInvoices(), db.listCustomers()])
      .then(([i, c]) => { setInvoices(i); setCustomers(c); setLoading(false) })
      .catch((e) => { setError(e.message || 'Could not load invoices'); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const byId = useMemo(() => {
    const m = {}
    for (const c of customers) m[c.id] = c
    return m
  }, [customers])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return invoices
      .map((i) => ({ ...i, customer: byId[i.customer_id] }))
      .filter((i) => (filter === 'all' ? true : i.status === filter))
      .filter((i) => !needle
        || (i.customer?.full_name || '').toLowerCase().includes(needle)
        || receiptNumber(i).toLowerCase().includes(needle))
  }, [invoices, byId, q, filter])

  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid')
    const open = invoices.filter((i) => i.status === 'unpaid' || i.status === 'sent')
    const sum = (a) => a.reduce((s, i) => s + Number(i.amount || 0), 0)
    return { paidCount: paid.length, paidSum: sum(paid), openCount: open.length, openSum: sum(open) }
  }, [invoices])

  async function markPaid(inv) {
    setBusy(inv.id)
    try {
      await db.updateInvoice(inv.id, { status: 'paid', paid_date: toISODate(new Date()) })
      await load()
      setToast(`${receiptNumber(inv)} marked paid.`)
    } catch (e) { setToast(`Could not update it: ${e.message}`) } finally { setBusy(null) }
  }

  async function remove(inv) {
    if (!confirm(`Delete ${receiptNumber(inv)}? This cannot be undone.`)) return
    setBusy(inv.id)
    try {
      await db.deleteInvoice(inv.id)
      await load()
      setToast('Invoice deleted.')
    } catch (e) { setToast(`Could not delete it: ${e.message}`) } finally { setBusy(null) }
  }

  async function sendSquare(inv) {
    setBusy(inv.id)
    try {
      const res = await createSquareInvoice({
        customer: inv.customer, amount: inv.amount, description: inv.description,
      })
      await db.updateInvoice(inv.id, {
        status: 'sent',
        square_invoice_id: res?.square_invoice_id || null,
        square_pay_url: res?.pay_url || null,
      })
      await load()
      setToast('Square invoice sent — the customer can now pay by card.')
    } catch (e) { setToast(`Square error: ${e.message}`) } finally { setBusy(null) }
  }

  function print(inv) {
    const ok = openReceipt({ invoice: inv, customer: inv.customer })
    if (!ok) setToast('Your browser blocked the receipt window. Allow pop-ups for this site, then try again.')
  }

  function pdf(inv) {
    const ok = downloadReceiptPdf({ invoice: inv, customer: inv.customer })
    setToast(ok
      ? 'Choose "Save as PDF" in the print box that just opened.'
      : 'Your browser blocked the download window. Allow pop-ups for this site, then try again.')
  }

  async function email(inv) {
    setBusy(inv.id)
    try {
      const res = await emailInvoice({ invoice: inv, customer: inv.customer })
      if (res.mode === 'crm') {
        await load() // an unpaid invoice becomes "sent" once it's emailed
        setToast(`${receiptNumber(inv)} emailed to ${res.to}.`)
      } else {
        setToast(`Your email app is opening with ${receiptNumber(inv)} ready for ${res.to}. Press Send there.`)
      }
    } catch (e) { setToast(`Not sent — ${e.message}`) } finally { setBusy(null) }
  }

  if (loading) return <p className="text-slate-400">Loading…</p>
  if (error) return <p className="text-rose-600">⚠️ {error}</p>

  return (
    <div className="space-y-4">
      {toast && (
        <div className="card p-3 flex items-center justify-between gap-3 border-emerald-200 bg-emerald-50">
          <span className="text-sm text-emerald-900">{toast}</span>
          <button className="text-emerald-700" onClick={() => setToast(null)}><X size={16} /></button>
        </div>
      )}

      <h1 className="text-xl font-bold flex items-center gap-2"><Receipt size={20} /> Invoices &amp; receipts</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-2xl font-bold leading-none text-emerald-700">{fmtMoney(totals.paidSum)}</div>
          <div className="text-xs text-slate-500 mt-1">Collected · {totals.paidCount} paid</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold leading-none text-amber-600">{fmtMoney(totals.openSum)}</div>
          <div className="text-xs text-slate-500 mt-1">Outstanding · {totals.openCount} open</div>
        </div>
      </div>

      {!paymentsEnabled() && (
        <div className="card p-4 text-sm text-slate-600">
          <strong className="text-slate-800">Card payments are off.</strong> You can still create invoices and
          print or save receipts as PDFs — that works today. To let customers pay by card, add your Square
          keys and set <code className="px-1 rounded bg-slate-100">VITE_PAYMENTS_ENABLED=true</code>
          {' '}(see <em>PAYMENTS-AND-REMINDERS.md</em>).
        </div>
      )}

      {invoiceEmailMode() === 'mail_app' && (
        <div className="card p-4 text-sm text-slate-600">
          <strong className="text-slate-800">Email works today through your own email app.</strong> Press
          {' '}<em>Email</em> on an invoice and your mail app opens with the customer's address, subject and
          receipt already filled in — you press Send. To have the CRM send the branded receipt itself, add your
          Resend key and set <code className="px-1 rounded bg-slate-100">VITE_EMAIL_ENABLED=true</code>
          {' '}(see <em>PAYMENTS-AND-REMINDERS.md</em>).
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by customer or receipt number…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{ key: 'all', label: 'All' }, ...INVOICE_STATUSES].map((s) => (
            <button
              key={s.key}
              className={filter === s.key ? 'btn-primary !h-9' : 'btn-ghost !h-9'}
              onClick={() => setFilter(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        {rows.length === 0 ? (
          <div className="text-sm text-slate-500 space-y-2">
            <p className="font-medium text-slate-700">No invoices here yet.</p>
            <p>
              Invoices are created from a customer's page: open a customer, find the booked cleaning
              in <strong>History</strong>, and press <strong>Mark done</strong> — the CRM creates the receipt
              for you. There's also a <strong>New invoice</strong> button on every customer's page, which can
              download the PDF or email it as soon as it's created.
            </p>
            <Link to="/contacts?class=customer" className="btn-ghost !h-9 inline-flex">Go to Customers</Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((inv) => {
              const si = statusInfo(inv.status)
              return (
                <li key={inv.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/customers/${inv.customer_id}`} className="font-medium hover:text-brand-600 truncate">
                        {inv.customer?.full_name || 'Unknown customer'}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${si.color}`}>{si.label}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {receiptNumber(inv)} · {fmtDate(inv.paid_date || inv.created_at)}
                      {inv.description ? ` · ${inv.description}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-800 w-20 text-right">{fmtMoney(inv.amount)}</span>
                    <button className="btn-ghost !h-8 !px-3" onClick={() => pdf(inv)}>
                      <Download size={14} /> PDF
                    </button>
                    <button className="btn-ghost !h-8 !px-3" onClick={() => print(inv)}>
                      <Printer size={14} /> Receipt
                    </button>
                    {canEdit && (
                      <button
                        className="btn-ghost !h-8 !px-3"
                        disabled={busy === inv.id || !inv.customer?.email}
                        title={inv.customer?.email
                          ? (invoiceEmailMode() === 'crm'
                            ? `Email it to ${inv.customer.email}`
                            : `Opens your email app addressed to ${inv.customer.email}`)
                          : 'This customer has no email address on file'}
                        onClick={() => email(inv)}
                      >
                        <Mail size={14} /> Email
                      </button>
                    )}
                    {canEdit && inv.status !== 'paid' && (
                      <button className="btn-ghost !h-8 !px-3 text-emerald-700" disabled={busy === inv.id} onClick={() => markPaid(inv)}>
                        <CheckCircle2 size={14} /> Paid
                      </button>
                    )}
                    {canEdit && paymentsEnabled() && inv.status === 'unpaid' && (
                      <button className="btn-ghost !h-8 !px-3" disabled={busy === inv.id} onClick={() => sendSquare(inv)}>
                        <Send size={14} /> Square
                      </button>
                    )}
                    {inv.square_pay_url && (
                      <a className="btn-ghost !h-8 !px-3" href={inv.square_pay_url} target="_blank" rel="noreferrer">Pay link</a>
                    )}
                    {isAdmin && (
                      <button className="btn-ghost !h-8 !px-2 text-rose-600" disabled={busy === inv.id} onClick={() => remove(inv)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
