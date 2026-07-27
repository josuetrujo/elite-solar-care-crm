// Central feature flags. Each feature stays OFF until the matching keys exist.
// This is what lets us "build now, add keys later".

const env = import.meta.env

export const SUPABASE_URL = env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || ''

// If Supabase keys are present we use the real cloud database + logins.
// If not, the app runs in LOCAL DEMO MODE (sample data in your browser).
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const FEATURES = {
  payments: env.VITE_PAYMENTS_ENABLED === 'true',
  sms: env.VITE_SMS_ENABLED === 'true',
  email: env.VITE_EMAIL_ENABLED === 'true',
}

export const PIPELINE = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-slate-100 text-slate-700' },
  { key: 'quoted', label: 'Quoted', color: 'bg-amber-100 text-amber-800' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
  { key: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'recurring', label: 'Recurring', color: 'bg-violet-100 text-violet-800' },
  { key: 'customer', label: 'Customer', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'not_interested', label: 'Not Interested', color: 'bg-orange-100 text-orange-800' },
  { key: 'lost', label: 'Lost', color: 'bg-rose-100 text-rose-700' },
]

export const RECURRING_OPTIONS = [
  { key: 'twice_a_year', label: 'Twice a year', months: 6 },
  { key: 'quarterly', label: 'Quarterly', months: 3 },
  { key: 'annually', label: 'Once a year', months: 12 },
  { key: 'none', label: 'One-time / none', months: null },
]

// Call outcome buttons. Each describes what pressing it does to the contact.
export const DISPOSITIONS = [
  { key: 'no_answer', label: 'No Answer', tone: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  { key: 'voicemail', label: 'Voicemail', tone: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  { key: 'busy', label: 'Busy', tone: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
  { key: 'call_later', label: 'Call Later', needsCallback: true, tone: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  { key: 'not_interested', label: 'Not Interested', setsStatus: 'not_interested', tone: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
  { key: 'bad_number', label: 'Wrong Number', setsBadNumber: true, tone: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
  { key: 'dnc', label: 'DNC', setsDnc: true, tone: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  { key: 'sale', label: 'SALE', opensSale: true, setsStatus: 'customer', tone: 'bg-emerald-600 text-white hover:bg-emerald-700' },
]

export const dispositionLabel = (k) => DISPOSITIONS.find((d) => d.key === k)?.label || k

// Contact lists (segments). Derived from customer fields — see lib/segments.js
export const SEGMENTS = {
  lead: { label: 'Leads', color: 'bg-slate-100 text-slate-700' },
  customer: { label: 'Customers', color: 'bg-emerald-100 text-emerald-800' },
  lost: { label: 'Lost', color: 'bg-orange-100 text-orange-800' },
  bad_number: { label: 'Bad Number', color: 'bg-amber-100 text-amber-800' },
  dnc: { label: 'Do Not Call', color: 'bg-rose-100 text-rose-700' },
}

export const APP_NAME = 'Elite Solar Care CRM'

// Your business details — these print on every receipt.
// If a phone number or email ever changes, change it here (one place).
export const BUSINESS = {
  name: 'ELITE SOLAR CARE LLC',
  tagline: 'Solar Panel Cleaning & Bird Proofing',
  serving: 'Serving Sacramento & the San Francisco Bay Area',
  phone: '(916) 743-2227',
  email: 'admin@elitesolarcare.com',
  thanks: 'Thank you for choosing Elite Solar Care — Sacramento & the Bay Area',
}

export const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'check', label: 'Check' },
  { key: 'card', label: 'Card / Digital' },
  { key: 'other', label: 'Other' },
]

export const INVOICE_STATUSES = [
  { key: 'unpaid', label: 'Unpaid', color: 'bg-amber-100 text-amber-800' },
  { key: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  { key: 'paid', label: 'Paid', color: 'bg-emerald-100 text-emerald-800' },
  { key: 'void', label: 'Void', color: 'bg-slate-100 text-slate-500' },
]
