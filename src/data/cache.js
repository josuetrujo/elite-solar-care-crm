// A very small in-memory cache so moving between screens doesn't re-download
// all 1,500+ contacts every single time. Lives for the browser session only —
// nothing is persisted, and any write clears it so you never see stale data.

const store = new Map()
const DEFAULT_TTL = 60_000 // 1 minute

export function cached(key, loader, ttl = DEFAULT_TTL) {
  const hit = store.get(key)
  const now = Date.now()
  if (hit && now - hit.at < ttl) return hit.value // may be a pending promise — that's fine,
                                                 // it de-duplicates two screens asking at once
  const value = Promise.resolve(loader()).catch((e) => {
    store.delete(key) // never cache a failure
    throw e
  })
  store.set(key, { at: now, value })
  return value
}

export function invalidate(prefix) {
  if (!prefix) { store.clear(); return }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}
