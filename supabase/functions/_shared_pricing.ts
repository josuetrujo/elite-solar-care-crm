// Shared pricing rules — single source for quote-price and create-booking-request.
// Owner's price list; percentages decided 2026-08-08; $10/panel from 2026-08-09.
export const PER_PANEL = 10
export const PER_STORY = 50
export const PER_MILE = 0.54
export const LONG_HAUL_START = 20
export const LONG_HAUL_PER_MILE = 1
export const NON_SHINGLE = 100
export const FIRST_TIME = 100
export const WATER_FEE = 100

export const PLANS: { key: string; label: string; pct: number; popular?: boolean }[] = [
  { key: 'one_time', label: 'One-time cleaning', pct: 0 },
  { key: 'monthly', label: 'Monthly', pct: 20 },
  { key: 'every_2', label: 'Every 2 months', pct: 15 },
  { key: 'every_3', label: 'Every 3 months', pct: 10, popular: true },
  { key: 'every_4', label: 'Every 4 months', pct: 7 },
  { key: 'every_6', label: 'Every 6 months', pct: 5 },
  { key: 'every_12', label: 'Once a year', pct: 0 },
]

export const MILES: Record<string, number> = {
  'sacramento': 10, 'north highlands': 3, 'antelope': 2, 'citrus heights': 5,
  'foothill farms': 4, 'rio linda': 6, 'elverta': 6, 'natomas': 8, 'carmichael': 10,
  'fair oaks': 12, 'orangevale': 12, 'west sacramento': 12, 'roseville': 12,
  'gold river': 14, 'rancho cordova': 15, 'granite bay': 15, 'rocklin': 18,
  'loomis': 20, 'folsom': 22, 'elk grove': 22, 'davis': 25, 'lincoln': 25,
  'el dorado hills': 28, 'woodland': 28, 'auburn': 32, 'galt': 32, 'plumas lake': 32,
  'wheatland': 35, 'dixon': 35, 'cameron park': 35, 'olivehurst': 38, 'winters': 40,
  'yuba city': 42, 'marysville': 42, 'lodi': 42, 'vacaville': 42, 'placerville': 45,
  'rio vista': 45, 'ione': 45, 'sutter creek': 50, 'fairfield': 52, 'stockton': 52,
  'suisun city': 52, 'jackson': 55, 'grass valley': 55, 'napa': 62, 'manteca': 65,
  'vallejo': 68, 'tracy': 70, 'san ramon': 72, 'concord': 75, 'dublin': 76,
  'pleasanton': 78, 'walnut creek': 78, 'richmond': 80, 'san rafael': 82,
  'berkeley': 82, 'livermore': 82, 'novato': 85, 'oakland': 85, 'alameda': 88,
  'san leandro': 90, 'san francisco': 90, 'petaluma': 95, 'hayward': 95,
  'daly city': 98, 'union city': 100, 'santa rosa': 105, 'san mateo': 105,
  'fremont': 105, 'redwood city': 112, 'palo alto': 118, 'milpitas': 120,
  'mountain view': 122, 'sunnyvale': 125, 'santa clara': 128, 'san jose': 130,
}

export const normCity = (raw: string) =>
  String(raw || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\bca(lifornia)?\b/g, '')
    .replace(/\s+/g, ' ').trim()

export type QuoteInput = {
  panels: number; stories: string; roof: string; city: string; water: string
}

// Returns null when out of area / invalid.
export function priceQuote(b: QuoteInput) {
  const panels = Math.floor(Number(b.panels))
  if (!panels || panels < 1 || panels > 2000) return null
  const groundMount = String(b.stories || '') === 'ground'
  const stories = groundMount ? 0 : Math.min(3, Math.max(1, Number(b.stories) || 1))
  const roof = String(b.roof || 'shingle').toLowerCase()
  const nonShingle = !groundMount && ['tile', 'flat', 'metal'].includes(roof)
  const noWater = String(b.water || '').toLowerCase() === 'no'
  const miles = MILES[normCity(b.city)]
  if (miles === undefined) return null
  const travel = miles * PER_MILE + Math.max(0, miles - LONG_HAUL_START) * LONG_HAUL_PER_MILE
  const base = panels * PER_PANEL + stories * PER_STORY +
    (nonShingle ? NON_SHINGLE : 0) + (noWater ? WATER_FEE : 0) + travel
  return { base, roof, noWater }
}
