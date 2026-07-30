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

// "123 Sunray Dr, Sacramento, CA 95842" — US convention: the zip follows the
// state with a space, not another comma.
function formatAddress({ street, city, state, zip }) {
  const cityLine = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ')
  return [street, cityLine].filter(Boolean).join(', ')
}

function serviceAddress(c) {
  return formatAddress({ street: c?.street_address, city: c?.city, state: c?.state, zip: c?.zip })
}

// Who the bill goes to. Falls back to the customer's own name and address for
// anything left blank, so a half-filled billing section can't produce a receipt
// addressed to nobody.
function billTo(c) {
  const useBilling = !!c?.billing_different
  const addr = useBilling
    ? formatAddress({
        street: c?.billing_street_address, city: c?.billing_city,
        state: c?.billing_state, zip: c?.billing_zip,
      })
    : ''
  const service = serviceAddress(c)
  return {
    name: (useBilling && c?.billing_name?.trim()) || c?.full_name || '—',
    address: addr || service || '—',
    service,
    // Only worth printing the service address separately when it really differs.
    showService: !!(service && addr && addr !== service),
  }
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
  const bill = billTo(customer)
  const dateStr = fmtDate(invoice.paid_date || invoice.created_at)

  const methodRows = PAYMENT_METHODS.map((m) => {
    const on = m.key === invoice.payment_method
    const extra = m.key === 'check' && invoice.check_no ? ` No. ${esc(invoice.check_no)}` : ''
    return `<div class="pm"><span class="box${on ? ' on' : ''}">${on ? '✓' : ''}</span>${esc(m.label)}${extra}</div>`
  }).join('')

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Receipt ${esc(receiptNumber(invoice))} — ${esc(bill.name)}</title>
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
  .grid2 .span2 { grid-column: 1 / -1; }
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
      <div><div class="k">${bill.showService || bill.name !== customer?.full_name ? 'Bill to' : 'Customer name'}</div><div class="v">${esc(bill.name)}</div></div>
      <div><div class="k">Phone</div><div class="v">${esc(customer?.phone || '—')}</div></div>
      <div><div class="k">${bill.showService ? 'Billing address' : 'Service address'}</div><div class="v">${esc(bill.address)}</div></div>
      <div><div class="k">Email</div><div class="v">${esc(customer?.email || '—')}</div></div>
      ${bill.showService
        ? `<div class="span2"><div class="k">Service address (where the work was done)</div><div class="v">${esc(bill.service)}</div></div>`
        : ''}
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

// ---- email versions of the same receipt ------------------------------------
// The subject line a customer sees, and a plain-text copy for mail apps that
// can't (or won't) show HTML.
export const receiptSubject = (invoice) =>
  `${invoice?.status === 'paid' ? 'Receipt' : 'Invoice'} ${receiptNumber(invoice)} — ${BUSINESS.name.replace(/ LLC$/i, '')}`

export function receiptText({ invoice, customer }) {
  const paid = invoice.status === 'paid'
  const bill = billTo(customer)
  const method = PAYMENT_METHODS.find((m) => m.key === invoice.payment_method)
  const nextClean = nextCleaningLine(customer, invoice)
  const firstName = String(customer?.first_name || bill.name || 'there').split(' ')[0]

  return [
    `Hi ${firstName},`,
    '',
    paid
      ? `Thank you — here is your receipt from ${BUSINESS.name}.`
      : `Here is your invoice from ${BUSINESS.name}.`,
    '',
    `${paid ? 'Receipt' : 'Invoice'} number: ${receiptNumber(invoice)}`,
    `Date: ${fmtDate(invoice.paid_date || invoice.created_at)}`,
    `Service: ${invoice.description || 'Solar Panel Cleaning'}`,
    bill.service ? `Service address: ${bill.service}` : '',
    `Total: ${fmtMoney(invoice.amount)}`,
    paid
      ? `Status: PAID IN FULL${method ? ` (${method.label.toLowerCase()})` : ''}`
      : 'Status: BALANCE DUE',
    invoice.notes ? `\n${invoice.notes}` : '',
    nextClean ? `\nRecommended next cleaning: ${nextClean}` : '',
    '',
    `Questions? Call ${BUSINESS.phone} or reply to this email.`,
    '',
    BUSINESS.thanks,
    BUSINESS.name,
  ].filter((l) => l !== '').join('\n')
}

// Opens the receipt in a new tab. Returns false if the browser blocked the popup.
export function openReceipt({ invoice, customer }) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(receiptHTML({ invoice, customer }))
  w.document.close()
  return true
}

// "Download PDF" — the same sheet, straight to the browser's print box, where
// "Destination: Save as PDF" writes the file (on a phone: Share → Save to
// Files). That is how a web page makes a PDF without shipping a PDF library,
// and it's the identical sheet, so a printed copy and a saved copy always match.
//
// It renders into a hidden iframe rather than a new tab because pop-up blockers
// silently swallow new tabs — the receipt has to come out every time. Chrome
// names the saved file after the PAGE title, so the title is borrowed for the
// length of the print and put straight back.
let appTitle = null

export function downloadReceiptPdf({ invoice, customer }) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('title', 'Receipt')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;'
  document.body.appendChild(frame)

  const doc = frame.contentWindow.document
  doc.open()
  doc.write(receiptHTML({ invoice, customer }))
  doc.close()

  // Remember the app's own title once. Reading it each time would capture a
  // receipt title if two receipts are saved back to back, and the tab would
  // keep that name for good.
  if (appTitle === null) appTitle = document.title
  let done = false
  const cleanUp = () => {
    if (done) return
    done = true
    document.title = appTitle
    frame.remove()
  }

  const go = () => {
    document.title = `Receipt ${receiptNumber(invoice)} — ${customer?.full_name || 'Elite Solar Care'}`
    frame.contentWindow.focus()
    frame.contentWindow.print()
    // afterprint doesn't fire everywhere, so a timer is the backstop. Removing
    // the iframe too early would cancel the print on some browsers.
    frame.contentWindow.addEventListener('afterprint', () => setTimeout(cleanUp, 300))
    setTimeout(cleanUp, 60000)
  }

  // Give the sheet a moment to lay out; printing a half-rendered page prints blank.
  if (doc.readyState === 'complete') setTimeout(go, 150)
  else frame.onload = () => setTimeout(go, 150)
  return true
}
