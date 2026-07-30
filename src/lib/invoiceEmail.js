// Emailing an invoice / receipt to the customer.
//
// Two ways, so this works today and gets better later:
//   'crm'      — Resend keys are set, so the CRM sends the branded receipt
//                itself through the send-invoice Edge Function. Nothing to do
//                by hand, and the send is logged against the customer.
//   'mail_app' — no keys yet: opens YOUR email app (Gmail, Mail, Outlook) with
//                the customer's address, subject and a plain-text copy of the
//                receipt already filled in. You press Send.
import { supabase } from './supabase'
import { emailEnabled, readFunctionError } from './notifications'
import { receiptHTML, receiptText, receiptSubject, receiptNumber } from './receipt'

export const invoiceEmailMode = () => (emailEnabled() ? 'crm' : 'mail_app')

// Where the receipt should go. A billing contact doesn't get its own email
// field, so this is the customer's address either way.
export const invoiceEmailTo = (customer) => (customer?.email || '').trim()

export async function emailInvoice({ invoice, customer }) {
  const to = invoiceEmailTo(customer)
  if (!to) throw new Error('This customer has no email address on file. Add one on their page first.')

  const subject = receiptSubject(invoice)
  const text = receiptText({ invoice, customer })

  if (invoiceEmailMode() === 'mail_app') {
    // mailto: is capped by the browser and the mail app (~2,000 characters is
    // the safe limit), so the plain-text copy goes in the body and the pretty
    // receipt stays a print-to-PDF attachment the owner can add.
    const url = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(text)}`
    const w = window.open(url, '_blank')
    if (!w) window.location.href = url
    return { mode: 'mail_app', to }
  }

  const { data, error } = await supabase.functions.invoke('send-invoice', {
    body: {
      invoice_id: invoice.id,
      subject,
      text,
      html: receiptHTML({ invoice, customer }),
      receipt_no: receiptNumber(invoice),
    },
  })
  if (error) throw new Error(await readFunctionError(error, 'Could not send the invoice.'))
  if (data?.error) throw new Error(data.error)
  return { mode: 'crm', to: data?.to || to }
}
