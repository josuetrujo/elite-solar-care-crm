// Unit test for the offline outbox — the piece that decides whether a call
// logged with no signal survives. Demo mode can't exercise it (it never touches
// the network), so it's tested directly here.

const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
// Node 22 exposes navigator as a getter-only global, so redefine it.
let ONLINE = true
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ get onLine() { return ONLINE } }),
})

const { enqueue, flush, pendingCount, isConnectionError } = await import('./src/lib/offline.js')

let failures = 0
const check = (name, cond, extra = '') => {
  if (cond) console.log('✓', name)
  else { console.log('✗', name, extra); failures++ }
}

// --- what counts as "no signal" -------------------------------------------
check('TypeError is a connection error', isConnectionError(new TypeError('Failed to fetch')))
check('"Load failed" (Safari) is a connection error', isConnectionError(new Error('Load failed')))
check('being offline forces a connection error', (() => {
  ONLINE = false
  const r = isConnectionError(new Error('anything'))
  ONLINE = true
  return r
})())
check('a database rejection is NOT a connection error',
  !isConnectionError(new Error('new row violates row-level security policy')))

// --- queue survives and drains in order ------------------------------------
store.clear()
enqueue({ customerId: 'a', dispositionKey: 'no_answer', opts: {} })
enqueue({ customerId: 'b', dispositionKey: 'voicemail', opts: {} })
enqueue({ customerId: 'c', dispositionKey: 'sale', opts: { sale: { quoted_amount: 250 } } })
check('three outcomes queued', pendingCount() === 3, `got ${pendingCount()}`)

// Still offline: nothing should drain, and nothing should be lost.
let r = await flush(async () => { throw new TypeError('Failed to fetch') })
check('nothing is sent while offline', r.sent === 0 && pendingCount() === 3, JSON.stringify(r))

// Back online: everything goes, oldest first.
const sentOrder = []
r = await flush(async (item) => { sentOrder.push(item.customerId) })
check('all three uploaded once back online', r.sent === 3 && pendingCount() === 0, JSON.stringify(r))
check('uploaded in the order they were logged', sentOrder.join(',') === 'a,b,c', sentOrder.join(','))

// --- a permanently-bad entry must not block the queue forever --------------
store.clear()
enqueue({ customerId: 'bad', dispositionKey: 'sale', opts: {} })
enqueue({ customerId: 'good', dispositionKey: 'no_answer', opts: {} })
const seen = []
r = await flush(async (item) => {
  seen.push(item.customerId)
  if (item.customerId === 'bad') throw new Error('violates row-level security policy')
})
check('a rejected entry is dropped rather than blocking', r.failed === 1 && r.sent === 1, JSON.stringify(r))
check('the good entry behind it still went up', seen.includes('good'))
check('queue is empty afterwards', pendingCount() === 0, `got ${pendingCount()}`)

// --- half-drained batch keeps the rest ------------------------------------
store.clear()
enqueue({ customerId: '1', dispositionKey: 'busy', opts: {} })
enqueue({ customerId: '2', dispositionKey: 'busy', opts: {} })
enqueue({ customerId: '3', dispositionKey: 'busy', opts: {} })
let n = 0
r = await flush(async () => { if (++n > 1) throw new TypeError('Failed to fetch') })
check('signal dropping mid-upload keeps the unsent ones', r.sent === 1 && pendingCount() === 2, JSON.stringify(r))

console.log(failures ? `\n${failures} FAILED` : '\nall outbox checks passed')
process.exit(failures ? 1 : 0)
