import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Login() {
  const { signIn, signUp, isDemo } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      if (mode === 'signup') await signUp(email, password, name)
      else await signIn(email, password)
    } catch (e) { setErr(e.message || 'Something went wrong') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <img src={logo} alt="" className="w-9 h-9 rounded-full" />
          <h1 className="text-lg font-display font-extrabold text-slate-800">Elite Solar Care</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          {isDemo ? 'Demo mode — no account needed.' : 'Sign in to continue'}
        </p>

        {isDemo ? (
          <button className="btn-primary w-full justify-center" onClick={() => signIn()}>
            Enter demo
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div><label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? 'Please wait…' : 'Sign in'}
            </button>
            <p className="text-center text-xs text-slate-400">Need access? Ask your admin to add you.</p>
          </form>
        )}
      </div>
    </div>
  )
}
