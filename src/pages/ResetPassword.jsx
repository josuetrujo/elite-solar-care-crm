import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

// Shown after clicking the "reset your password" link in the email. Supabase
// has already signed the user in with a one-time token by this point, so all
// that's left is choosing the new password.
export default function ResetPassword() {
  const { updatePassword, endRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (password.length < 8) { setErr('Use at least 8 characters.'); return }
    if (password !== confirm) { setErr('The two passwords don\'t match.'); return }
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (e) {
      setErr(e.message === 'Auth session missing!'
        ? 'This reset link has expired. Go back and request a new one.'
        : e.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <img src={logo} alt="" className="w-9 h-9 rounded-full" />
          <h1 className="text-lg font-display font-extrabold text-slate-800">Elite Solar Care</h1>
        </div>

        {done ? (
          <>
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 my-4">
              Password changed. You're signed in.
            </p>
            <button className="btn-primary w-full justify-center" onClick={endRecovery}>
              Go to the CRM
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-5">Choose a new password</p>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">New password</label>
                <input className="input" type="password" autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
              </div>
              <div>
                <label className="label">Type it again</label>
                <input className="input" type="password" autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              {err && <p className="text-sm text-rose-600">{err}</p>}
              <button className="btn-primary w-full justify-center" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
              <button
                type="button"
                className="w-full text-center text-xs text-slate-500 hover:underline pt-1"
                onClick={async () => { await signOut(); endRecovery() }}
              >
                Cancel and go back to sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
