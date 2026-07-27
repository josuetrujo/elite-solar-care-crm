import { FEATURES } from './config'
import { supabase } from './supabase'

// SMS (Twilio) and Email (Resend) reminders. OFF until keys are added.
// When enabled, sending calls a Supabase Edge Function "send-reminder"
// so Twilio/Resend secrets stay server-side.

export const smsEnabled = () => FEATURES.sms && Boolean(supabase)
export const emailEnabled = () => FEATURES.email && Boolean(supabase)
export const remindersEnabled = () => smsEnabled() || emailEnabled()

export async function sendReminder({ customer, kind = 'service_due', channel }) {
  // channel: 'sms' | 'email' | undefined (auto: prefer SMS, fall back to email)
  const useSms = channel === 'sms' || (!channel && smsEnabled())
  const useEmail = channel === 'email' || (!channel && !useSms && emailEnabled())

  if (useSms && !smsEnabled()) throw new Error('SMS not enabled yet.')
  if (useEmail && !emailEnabled()) throw new Error('Email not enabled yet.')
  if (!useSms && !useEmail) throw new Error('No reminder channel enabled yet.')

  // Respect consent before messaging (legal requirement).
  if (useSms && !customer.consent_sms) throw new Error('Customer has not consented to SMS.')
  if (useEmail && !customer.consent_email) throw new Error('Customer has not consented to email.')

  const { data, error } = await supabase.functions.invoke('send-reminder', {
    body: { customer, kind, channel: useSms ? 'sms' : 'email' },
  })
  if (error) throw new Error(await readFunctionError(error, 'Could not send the reminder.'))
  if (data?.error) throw new Error(data.error)
  return data
}

// Supabase wraps non-2xx responses in a generic error. The useful sentence is
// in the response body, so dig it out — otherwise the owner just sees
// "Edge Function returned a non-2xx status code", which explains nothing.
export async function readFunctionError(error, fallback) {
  try {
    const body = await error?.context?.json?.()
    if (body?.error) return body.error
  } catch (_) { /* not JSON — fall through */ }
  return error?.message || fallback
}
