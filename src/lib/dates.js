import { RECURRING_OPTIONS } from './config'

// Parse 'YYYY-MM-DD' as a LOCAL date (not UTC) to avoid off-by-one in the
// Pacific timezone. Other values fall back to the normal Date parser.
export function parseLocalDate(value) {
  if (value == null) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(value)
  return isNaN(d) ? null : d
}

export function addMonths(date, months) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function toISODate(date) {
  const d = parseLocalDate(date)
  if (!d) return null
  // local Y-M-D (avoids UTC shifting the day)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function nextDueFrom(startDate, frequencyKey) {
  const opt = RECURRING_OPTIONS.find((o) => o.key === frequencyKey)
  if (!opt || opt.months == null || !startDate) return null
  return toISODate(addMonths(startDate, opt.months))
}

export function daysUntil(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / (1000 * 60 * 60 * 24))
}

export function fmtDate(dateStr) {
  const d = parseLocalDate(dateStr)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtMoney(n) {
  if (n == null || n === '') return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
