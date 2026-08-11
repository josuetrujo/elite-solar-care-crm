// Phone helpers. Imported lists are messy — blanks, "n/a", 5-digit fragments —
// and a contact you can't dial is worse than no contact, because it sits in the
// call queue looking like work.

export const digitsOnly = (phone) => String(phone || '').replace(/\D/g, '')

// A number we can actually dial: 10 digits, or 11 starting with a US country code.
export function usablePhone(phone) {
  const d = digitsOnly(phone)
  if (d.length === 10) return true
  if (d.length === 11 && d.startsWith('1')) return true
  return false
}

// Normalised key for spotting the same person entered twice.
export function phoneKey(phone) {
  const d = digitsOnly(phone)
  if (d.length === 11 && d.startsWith('1')) return d.slice(1)
  return d.length === 10 ? d : ''
}

// (888) 883-3008
export function formatPhone(phone) {
  const d = phoneKey(phone)
  if (!d) return phone || ''
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}
