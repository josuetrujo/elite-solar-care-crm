// Which classification a contact belongs to, derived from its fields (no extra
// column). These four lists are the single source of truth — the database
// provider filters with the same groups so browser and server always agree.
export const CUSTOMER_STATUSES = ['customer', 'scheduled', 'completed', 'recurring']
export const LOST_STATUSES = ['not_interested', 'lost']
export const LEAD_STATUSES = ['new_lead', 'quoted']

export function segmentOf(c) {
  if (c.do_not_call) return 'dnc'
  if (c.bad_number) return 'bad_number'
  if (CUSTOMER_STATUSES.includes(c.status)) return 'customer'
  if (LOST_STATUSES.includes(c.status)) return 'lost'
  return 'lead'
}

export const isLead = (c) => segmentOf(c) === 'lead'
export const isCustomer = (c) => segmentOf(c) === 'customer'

// The field changes that move a contact into a classification. Picking
// "Customer" on a contact who is already 'scheduled' keeps that finer stage —
// only a contact coming from another list gets a fresh default status.
export function classificationPatch(segment, current = {}) {
  switch (segment) {
    case 'dnc':
      return { do_not_call: true }
    case 'bad_number':
      return { do_not_call: false, bad_number: true }
    case 'customer':
      return {
        do_not_call: false, bad_number: false,
        status: CUSTOMER_STATUSES.includes(current.status) ? current.status : 'customer',
      }
    case 'lost':
      return {
        do_not_call: false, bad_number: false,
        status: LOST_STATUSES.includes(current.status) ? current.status : 'not_interested',
      }
    case 'lead':
      return {
        do_not_call: false, bad_number: false,
        status: LEAD_STATUSES.includes(current.status) ? current.status : 'new_lead',
      }
    default:
      return {}
  }
}
