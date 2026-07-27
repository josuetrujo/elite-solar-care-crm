// Which list a contact belongs to, derived from its fields (no extra column).
export function segmentOf(c) {
  if (c.do_not_call) return 'dnc'
  if (c.bad_number) return 'bad_number'
  if (['customer', 'scheduled', 'completed', 'recurring'].includes(c.status)) return 'customer'
  if (['not_interested', 'lost'].includes(c.status)) return 'lost'
  return 'lead'
}

export const isLead = (c) => segmentOf(c) === 'lead'
export const isCustomer = (c) => segmentOf(c) === 'customer'
