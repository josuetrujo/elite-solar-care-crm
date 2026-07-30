// Emails an invoice / receipt to the customer through Resend.
//
// The browser sends the invoice id and the receipt it already rendered; this
// function decides WHO it goes to by re-reading the invoice and the customer
// server-side, so a browser can never redirect a receipt to some other address.
// The caller must be a signed-in, approved admin or member.
//
// Every send is written to the `reminders` table (kind 'invoice'), so the
// customer's history shows when the receipt went out. Unlike service reminders
// there is no 7-day block — re-sending a receipt on request is normal.
//
// Deploy:   supabase functions deploy send-invoice
// Secrets:  RESEND_API_KEY, REMINDER_FROM_EMAIL, BUSINESS_PHONE (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

const BUSINESS_NAME = 'Elite Solar Care'
const BUSINESS_PHONE = Deno.env.get('BUSINESS_PHONE') || '(916) 743-2227'

// A receipt is a big document; cap what a browser may hand us.
const MAX_HTML = 200_000
const MAX_TEXT = 20_000

async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM_EMAIL')
  if (!key || !from) throw new Error('Resend secrets are not set in Supabase.')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: `${text}\n\n— ${BUSINESS_NAME}\n${BUSINESS_PHONE}`,
      ...(html ? { html } : {}),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Resend: ${data?.message || res.statusText}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { invoice_id, subject, text, html, receipt_no } = await req.json()
    if (!invoice_id) return json({ error: 'An invoice is required.' }, 400)
    if (!text) return json({ error: 'The receipt text is missing.' }, 400)
    if (String(html || '').length > MAX_HTML || String(text).length > MAX_TEXT) {
      return json({ error: 'That receipt is too large to email.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Who is asking? Only an approved admin/member may email a customer.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Sign in first.' }, 401)
    const { data: userRes } = await admin.auth.getUser(jwt)
    const uid = userRes?.user?.id
    if (!uid) return json({ error: 'Sign in first.' }, 401)
    const { data: profile } = await admin
      .from('profiles').select('role, approved, active').eq('id', uid).single()
    if (!profile?.approved || profile?.active === false || !['admin', 'member'].includes(profile?.role)) {
      return json({ error: 'Your account is not allowed to send invoices.' }, 403)
    }

    // The recipient comes from the database, never from the request body.
    const { data: invoice, error: invErr } = await admin
      .from('invoices').select('*').eq('id', invoice_id).single()
    if (invErr || !invoice) return json({ error: 'Invoice not found.' }, 404)

    const { data: customer, error: custErr } = await admin
      .from('customers').select('*').eq('id', invoice.customer_id).single()
    if (custErr || !customer) return json({ error: 'Customer not found.' }, 404)

    const to = (customer.email || '').trim()
    if (!to) return json({ error: 'This customer has no email address on file.' }, 400)

    // Note: a receipt for work already done is transactional, so it does NOT
    // require the marketing email opt-in (consent_email). That flag gates
    // reminders and follow-ups, which is where it legally belongs.
    await sendEmail(to, subject || `Receipt ${receipt_no || ''} — ${BUSINESS_NAME}`.trim(), text, html)

    await admin.from('reminders').insert({
      customer_id: customer.id,
      channel: 'email',
      kind: 'invoice',
      status: 'sent',
    })

    // Once a receipt is out the door an unpaid invoice counts as sent.
    if (invoice.status === 'unpaid') {
      await admin.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    }

    return json({ ok: true, to, invoice_id, status: invoice.status === 'unpaid' ? 'sent' : invoice.status })
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 400)
  }
})
