import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

// HashRouter is used so the app works on GitHub Pages, a NAS, or any host
// without server-side routing config.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)

// Service worker: makes the app open with no signal. Only in a real build —
// during `npm run dev` it would cache half-built files and cause confusion.
// Escape hatch: open the site with ?nosw to unregister it.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const bypass = new URLSearchParams(window.location.search).has('nosw')
  window.addEventListener('load', async () => {
    try {
      if (bypass) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
        return
      }
      const base = import.meta.env.BASE_URL || './'
      await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
    } catch (e) {
      // Offline support is a bonus — never let it break the app.
      console.warn('Service worker not registered:', e?.message)
    }
  })
}
