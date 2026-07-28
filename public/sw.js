/* Elite Solar Care CRM — service worker.
 *
 * Purpose: let the app OPEN when there's no signal, so a lost connection in a
 * driveway doesn't mean a blank screen. Call outcomes logged while offline are
 * held by the app itself (see src/lib/offline.js) and uploaded later.
 *
 * Deliberately conservative:
 *   - API traffic (Supabase) is NEVER cached — stale customer data would be worse
 *     than no data.
 *   - Build assets are content-hashed by Vite, so they're safe to cache forever.
 *   - Page loads try the network first, so a deploy is picked up immediately.
 */

const VERSION = 'esc-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(['./', './index.html', './manifest.webmanifest']).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  )
})

// Let the page force an update without the user reinstalling anything.
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Anything not served from this site — above all the Supabase API — goes
  // straight to the network, always.
  if (url.origin !== self.location.origin) return

  // Page navigations: network first, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('./index.html', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    )
    return
  }

  // Hashed build files and icons: serve from cache, fetch once, keep.
  if (/\.(js|css|png|jpg|jpeg|svg|woff2?|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(ASSETS).then((c) => c.put(request, copy)).catch(() => {})
        }
        return res
      })),
    )
  }
})
