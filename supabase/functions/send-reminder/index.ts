// Sends a "your solar panels are due for a cleaning" reminder by SMS (Twilio)
// or email (Resend), and writes a row into the `reminders` table so the same
// message never goes out twice in the same week.
//
// Runs on Supabase Edge Functions (Deno) so Twilio/Resend secrets stay
// server-side. Consent is re-checked HERE as well as in the browser — the
// server is the part that can't be bypassed.
//
// Deploy:   supabase functions deploy send-reminder
// Secrets:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//           RESEND_API_KEY, REMINDER_FROM_EMAIL, BUSINESS_PHONE

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

function messageFor(kind: string, customer: Record<string, unknown>) {
  const name = String(customer.first_name || customer.full_name || 'there').split(' ')[0]
  switch (kind) {
    case 'quote_followup':
      return {
        subject: `Your solar panel cleaning quote — ${BUSINESS_NAME}`,
        text: `Hi ${name}, this is ${BUSINESS_NAME} following up on your solar panel cleaning quote. `
          + `Happy to answer any questions or get you on the schedule — just reply or call ${BUSINESS_PHONE}.`,
      }
    case 'appointment_tomorrow':
      return {
        subject: `Reminder: your cleaning is tomorrow — ${BUSINESS_NAME}`,
        text: `Hi ${name}, a quick reminder that ${BUSINESS_NAME} is scheduled to clean your solar panels tomorrow. `
          + `Please make sure we can reach the panels and any gates are unlocked. Questions? Call ${BUSINESS_PHONE}.`,
      }
    default: // service_due
      return {
        subject: `Time for your solar panel cleaning — ${BUSINESS_NAME}`,
        text: `Hi ${name}, your solar panels are due for their regular cleaning with ${BUSINESS_NAME}. `
          + `Dirty panels can cut production noticeably. Reply or call ${BUSINESS_PHONE} and we'll find a day that works.`,
      }
  }
}

async function sendSms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_PHONE_NUMBER')
  if (!sid || !token || !from) throw new Error('Twilio secrets are not set in Supabase.')

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Twilio: ${data?.message || res.statusText}`)
  return data
}

async function sendEmail(to: string, subject: string, text: string) {
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
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Resend: ${data?.message || res.statusText}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { customer, kind = 'service_due', channel } = await req.json()
    if (!customer?.id) return json({ error: 'A customer is required.' }, 400)
    if (channel !== 'sms' && channel !== 'email') {
      return json({ error: 'channel must be "sms" or "email".' }, 400)
    }

    // Re-read the customer server-side: never trust consent flags sent by a browser.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: row, error: readErr } = await admin
      .from('customers').select('*').eq('id', customer.id).single()
    if (readErr || !row) return json({ error: 'Customer not found.' }, 404)

    if (row.do_not_call) return json({ error: 'This contact is on the Do Not Call list.' }, 400)
    if (channel === 'sms' && !row.consent_sms) return json({ error: 'This customer has not opted in to text messages.' }, 400)
    if (channel === 'email' && !row.consent_email) return json({ error: 'This customer has not opted in to email.' }, 400)

    const destination = channel === 'sms' ? row.phone : row.email
    if (!destination) return json({ error: `This customer has no ${channel === 'sms' ? 'phone number' : 'email address'} on file.` }, 400)

    // Don't send the same kind of reminder twice in 7 days.
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: recent } = await admin
      .from('reminders').select('id')
      .eq('customer_id', row.id).eq('kind', kind).eq('channel', channel)
      .gte('sent_at', weekAgo).limit(1)
    if (recent && recent.length > 0) {
      return json({ error: 'A reminder like this already went out in the last 7 days.' }, 409)
    }

    const msg = messageFor(kind, row)
    if (channel === 'sms') await sendSms(destination, msg.text)
    else await sendEmail(destination, msg.subject, msg.text)

    await admin.from('reminders').insert({
      customer_id: row.id, channel, kind, status: 'sent',
    })

    return json({ ok: true, channel, to: destination })
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 400)
  }
})
