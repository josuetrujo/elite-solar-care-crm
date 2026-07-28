// Offline outbox for call outcomes.
//
// Josue calls leads from driveways and rooftops where signal drops. Losing a
// logged call because a request timed out is the worst possible failure: he
// has to remember it and re-enter it. So when the network is unavailable the
// outcome goes into a queue in the browser and is sent the moment it comes back.

const KEY = 'esc_outbox'
const listeners = new Set()

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function write(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
  listeners.forEach((fn) => { try { fn(items.length) } catch (_) {} })
}

export const pendingCount = () => read().length

export function onPendingChange(fn) {
  listeners.add(fn)
  fn(pendingCount())
  return () => listeners.delete(fn)
}

// Anything that isn't the server saying "no" is treated as a connection
// problem. A 4xx from Postgres means the request was wrong and retrying it
// forever would be pointless — those are surfaced to the user instead.
export function isConnectionError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String(err?.message || err || '').toLowerCase()
  return (
    err instanceof TypeError ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  )
}

export function enqueue(entry) {
  const items = read()
  items.push({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, queuedAt: new Date().toISOString() })
  write(items)
}

let flushing = false

// Sends everything waiting. Stops at the first connection failure so the order
// calls were made in is preserved. Returns { sent, failed, remaining }.
export async function flush(send) {
  if (flushing) return { sent: 0, failed: 0, remaining: pendingCount() }
  flushing = true
  let sent = 0, failed = 0
  try {
    let items = read()
    while (items.length) {
      const item = items[0]
      try {
        await send(item)
        sent++
        items = read().filter((x) => x.id !== item.id)
        write(items)
      } catch (e) {
        if (isConnectionError(e)) break // still offline — try again later
        // The server rejected it. Keeping it would block the queue forever.
        failed++
        items = read().filter((x) => x.id !== item.id)
        write(items)
        console.warn('[outbox] dropped an entry the server rejected:', e?.message, item)
      }
    }
  } finally { flushing = false }
  return { sent, failed, remaining: pendingCount() }
}
