// Quote calculator based on Elite Solar Care's documented pricing.
// (See vault: 02-Sources/Company-Documents/Pricing.md)
//   $10 per panel, $50 per story, $0.54 per mile,
//   +$100 non-shingle roof, +$100 first-time customer.
export const RATES = {
  perPanel: 10,
  perStory: 50,
  perMile: 0.54,
  nonShingleSurcharge: 100,
  firstTimeSurcharge: 100,
}

export function estimateQuote({
  panelCount = 0,
  stories = 1,
  miles = 0,
  nonShingleRoof = false,
  firstTime = false,
} = {}) {
  const lines = []
  const panels = (Number(panelCount) || 0) * RATES.perPanel
  if (panels) lines.push({ label: `${panelCount} panels × $${RATES.perPanel}`, amount: panels })
  const story = (Number(stories) || 0) * RATES.perStory
  if (story) lines.push({ label: `${stories} story × $${RATES.perStory}`, amount: story })
  const travel = (Number(miles) || 0) * RATES.perMile
  if (travel) lines.push({ label: `${miles} mi × $${RATES.perMile}`, amount: Math.round(travel * 100) / 100 })
  if (nonShingleRoof) lines.push({ label: 'Non-shingle roof', amount: RATES.nonShingleSurcharge })
  if (firstTime) lines.push({ label: 'First-time customer', amount: RATES.firstTimeSurcharge })
  const total = lines.reduce((s, l) => s + l.amount, 0)
  return { lines, total: Math.round(total * 100) / 100 }
}
