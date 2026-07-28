import { useState } from 'react'
import { ShieldCheck, RefreshCw, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

// What a signed-in but not-yet-approved account sees. They can reach this
// screen and nothing else — the database returns no rows for them either way,
// so this is the friendly explanation rather than the actual lock.
export default function PendingApproval() {
  const { user, refresh, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  async function check() {
    setBusy(true)
    try { await refresh() } finally { setBusy(false) }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 text-center">
        <img src={logo} alt="" className="w-12 h-12 rounded-full mx-auto mb-3" />
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
          <ShieldCheck className="text-amber-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-800">Waiting for approval</h1>
        <p className="text-sm text-slate-500 mt-2">
          Your account (<b>{user?.email}</b>) was created, but an administrator has to let you in
          before you can see any customer information.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Ask Josue to open <b>Settings → Team</b> and approve you. It takes him one tap.
        </p>
        <div className="flex gap-2 justify-center mt-5">
          <button className="btn-primary" onClick={check} disabled={busy}>
            <RefreshCw size={16} /> {busy ? 'Checking…' : 'Check again'}
          </button>
          <button className="btn-ghost" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
