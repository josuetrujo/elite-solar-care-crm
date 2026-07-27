// Printable receipt. Opens a clean, branded page in a new tab; the owner then
// uses the browser's own Print dialog and picks "Save as PDF" (or AirPrint from
// a phone). No extra libraries, works offline, and looks the same everywhere.
import { BUSINESS, PAYMENT_METHODS, RECURRING_OPTIONS } from './config'
import { fmtMoney, fmtDate, parseLocalDate, nextDueFrom } from './dates'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const receiptNumber = (inv) =>
  inv?.receipt_no ? `ESC-${inv.receipt_no}` : 'ESC-DRAFT'

function serviceAddress(c) {
  return [c?.street_address, [c?.city, c?.state].filter(Boolean).join(', '), c?.zip]
    .filter(Boolean).join(', ')
}

// "January 2027 (every 6 months)"
function nextCleaningLine(customer, invoice) {
  const freq = customer?.recurring_frequency || 'twice_a_year'
  const opt = RECURRING_OPTIONS.find((o) => o.key === freq)
  if (!opt || opt.months == null) return null
  const from = parseLocalDate(invoice?.paid_date || invoice?.created_at) || new Date()
  const next = parseLocalDate(nextDueFrom(from, freq))
  if (!next) return null
  const when = next.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return `${when} (every ${opt.months} months)`
}

export function receiptHTML({ invoice, customer }) {
  const total = Number(invoice.amount || 0)
  const discount = Number(invoice.discount || 0)
  const tax = Number(invoice.tax || 0)
  const subtotal = total + discount - tax
  const paid = invoice.status === 'paid'
  const method = PAYMENT_METHODS.find((m) => m.key === invoice.payment_method)
  const nextClean = nextCleaningLine(customer, invoice)
  const dateStr = fmtDate(invoice.paid_date || invoice.created_at)

  const methodRows = PAYMENT_METHODS.map((m) => {
    const on = m.key === invoice.payment_method
    const extra = m.key === 'check' && invoice.check_no ? ` No. ${esc(invoice.check_no)}` : ''
    return `<div class="pm"><span class="box${on ? ' on' : ''}">${on ? '✓' : ''}</span>${esc(m.label)}${extra}</div>`
  }).join('')

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Receipt ${esc(receiptNumber(invoice))} — ${esc(customer?.full_name || '')}</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
         color: #0B0B0C; margin: 0; padding: 24px; background: #fff; font-size: 12px; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
         border-bottom: 4px solid #004AAD; padding-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 900; letter-spacing: .02em; color: #004AAD; }
  .tag { font-size: 11px; color: #444; margin-top: 3px; }
  .contact { font-size: 11px; color: #444; margin-top: 6px; }
  .word { font-size: 26px; font-weight: 900; letter-spacing: .12em; color: #EC5002; }
  .meta { margin-top: 4px; font-size: 11px; text-align: right; color: #444; }
  h2 { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #004AAD;
       margin: 22px 0 6px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .k { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #888; }
  .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { font-size: 9px; letter-spacing: .1em; text-transform: uppercase; color: #888;
       text-align: left; padding: 6px 0; border-bottom: 1px solid #E2E8F0; }
  td { padding: 8px 0; border-bottom: 1px solid #F1F5F9; }
  th.r, td.r { text-align: right; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 6px; }
  .pm { margin: 5px 0; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #004AAD;
         border-radius: 3px; margin-right: 8px; vertical-align: -2px; text-align: center;
         line-height: 11px; font-size: 10px; color: #fff; }
  .box.on { background: #004AAD; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid #004AAD; margin-top: 6px; padding-top: 8px;
                   font-size: 15px; font-weight: 900; color: #004AAD; }
  .stamp { display: inline-block; margin-top: 10px; padding: 5px 12px; border-radius: 999px;
           font-weight: 800; font-size: 11px; letter-spacing: .06em; }
  .paid { background: #ECFDF5; color: #047857; border: 1.5px solid #047857; }
  .due  { background: #FFF7ED; color: #C2410C; border: 1.5px solid #C2410C; }
  .note { margin-top: 6px; color: #333; line-height: 1.5; }
  .next { margin-top: 6px; font-weight: 700; color: #004AAD; }
  .foot { margin-top: 26px; padding-top: 12px; border-top: 1px solid #E2E8F0;
          text-align: center; color: #666; font-size: 10px; }
  .actions { max-width: 7.4in; margin: 0 auto 18px; display: flex; gap: 10px; }
  .actions button { font: inherit; font-weight: 700; padding: 10px 18px; border-radius: 8px;
                    border: 0; background: #004AAD; color: #fff; cursor: pointer; }
  .actions .ghost { background: #fff; color: #334155; border: 1px solid #CBD5E1; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="actions">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="ghost" onclick="window.close()">Close</button>
  </div>

  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">${esc(BUSINESS.name)}</div>
        <div class="tag">${esc(BUSINESS.tagline)}</div>
        <div class="tag">${esc(BUSINESS.serving)}</div>
        <div class="contact">Phone: ${esc(BUSINESS.phone)} &nbsp;·&nbsp; Email: ${esc(BUSINESS.email)}</div>
      </div>
      <div style="text-align:right">
        <div class="word">RECEIPT</div>
        <div class="meta"><strong>${esc(receiptNumber(invoice))}</strong><br />${esc(dateStr)}</div>
      </div>
    </div>

    <h2>Billed to</h2>
    <div class="grid2">
      <div><div class="k">Customer name</div><div class="v">${esc(customer?.full_name || '—')}</div></div>
      <div><div class="k">Phone</div><div class="v">${esc(customer?.phone || '—')}</div></div>
      <div><div class="k">Service address</div><div class="v">${esc(serviceAddress(customer) || '—')}</div></div>
      <div><div class="k">Email</div><div class="v">${esc(customer?.email || '—')}</div></div>
    </div>

    <h2>Services provided</h2>
    <table>
      <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>${esc(invoice.description || 'Solar Panel Cleaning')}</td>
          <td class="r">1</td>
          <td class="r">${esc(fmtMoney(subtotal))}</td>
          <td class="r">${esc(fmtMoney(subtotal))}</td>
        </tr>
      </tbody>
    </table>

    <div class="cols">
      <div>
        <h2>Payment method</h2>
        ${methodRows}
        <div class="stamp ${paid ? 'paid' : 'due'}">${paid ? 'PAID IN FULL' : 'BALANCE DUE'}</div>
      </div>
      <div>
        <h2>Total</h2>
        <div class="totals">
          <div><span>Subtotal</span><span>${esc(fmtMoney(subtotal))}</span></div>
          <div><span>Discount</span><span>${esc(fmtMoney(discount))}</span></div>
          <div><span>Tax</span><span>${esc(fmtMoney(tax))}</span></div>
          <div><span>Amount paid</span><span>${esc(paid ? fmtMoney(total) : fmtMoney(0))}</span></div>
          <div class="grand"><span>TOTAL</span><span>${esc(fmtMoney(total))}</span></div>
        </div>
      </div>
    </div>

    ${invoice.notes ? `<h2>Notes</h2><div class="note">${esc(invoice.notes)}</div>` : ''}
    ${nextClean ? `<h2>Recommended next cleaning</h2><div class="next">${esc(nextClean)}</div>` : ''}

    <div class="foot">${esc(BUSINESS.thanks)}</div>
  </div>
</body></html>`
}

// Opens the receipt in a new tab. Returns false if the browser blocked the popup.
export function openReceipt({ invoice, customer }) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(receiptHTML({ invoice, customer }))
  w.document.close()
  return true
}
