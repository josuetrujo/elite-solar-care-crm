import { USE_SUPABASE } from '../lib/config'
import { localProvider } from './localProvider'
import { supabaseProvider } from './supabaseProvider'
import { cached, invalidate } from './cache'

const provider = USE_SUPABASE ? supabaseProvider : localProvider

// Reads that are worth caching for a minute (they're the expensive, repeated
// ones). Anything not listed here goes straight through.
const CACHED_READS = {
  listCustomers: (args) => `customers:all:${JSON.stringify(args)}`,
  listJobs: (args) => `jobs:${JSON.stringify(args)}`,
  listCalls: (args) => `calls:${JSON.stringify(args)}`,
  listInvoices: (args) => `invoices:${JSON.stringify(args)}`,
  queryCustomers: (args) => `customers:query:${JSON.stringify(args)}`,
  countCustomersBySegment: (args) => `customers:counts:${JSON.stringify(args)}`,
}

// Any write blows away the cached reads it could possibly affect.
const WRITE_INVALIDATES = {
  createCustomer: ['customers'], updateCustomer: ['customers'], deleteCustomer: ['customers'],
  createJob: ['jobs', 'customers'], updateJob: ['jobs', 'customers'],
  createInvoice: ['invoices'], updateInvoice: ['invoices'], deleteInvoice: ['invoices'],
  createCall: ['calls', 'customers'], logDisposition: ['calls', 'customers'],
  mergeCustomers: ['customers', 'calls', 'jobs', 'invoices'],
  resetDemo: [''],
}

export const db = new Proxy(provider, {
  get(target, prop) {
    const fn = target[prop]
    if (typeof fn !== 'function') return fn

    const keyFor = CACHED_READS[prop]
    const invalidates = WRITE_INVALIDATES[prop]

    return (...args) => {
      if (keyFor) return cached(keyFor(args), () => fn.apply(target, args))
      const out = fn.apply(target, args)
      if (invalidates) {
        Promise.resolve(out).then(
          () => invalidates.forEach((p) => invalidate(p)),
          () => invalidates.forEach((p) => invalidate(p)),
        )
      }
      return out
    }
  },
})

export { invalidate }
