import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

export default function Login() {
  const { signIn, signUp, requestPasswordReset, isDemo } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  function switchTo(next) {
    setMode(next); setErr(''); setMsg(''); setPassword('')
  }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setMsg(''); setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email, password, name)
        setMsg('Account created. Josue needs to approve it before you can see anything — he gets a note in Settings → Team.')
        setMode('signin')
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setMsg(`If ${email} has an account, a reset link is on its way. Check your email (and the spam folder).`)
      } else {
        await signIn(email, password)
      }
    } catch (e) {
      setErr(friendly(e.message))
    } finally { setBusy(false) }
  }

  const title = mode === 'signup' ? 'Create your account'
    : mode === 'forgot' ? 'Reset your password'
      : 'Sign in to continue'

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <img src={logo} alt="" className="w-9 h-9 rounded-full" />
          <h1 className="text-lg font-display font-extrabold text-slate-800">Elite Solar Care</h1>
        </div>
        <p className="text-sm text-slate-500 mb-5">{isDemo ? 'Demo mode — no account needed.' : title}</p>

        {isDemo ? (
          <button className="btn-primary w-full justify-center" onClick={() => signIn()}>
            Enter demo
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="label">Your name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input className="input" type="email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="label">Password</label>
                <input
                  className="input" type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                />
                {mode === 'signup' && (
                  <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
                )}
              </div>
            )}

            {err && <p className="text-sm text-rose-600">{err}</p>}
            {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-2.5">{msg}</p>}

            <button className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? 'Please wait…'
                : mode === 'signup' ? 'Create account'
                  : mode === 'forgot' ? 'Email me a reset link'
                    : 'Sign in'}
            </button>

            <div className="text-center text-xs text-slate-500 space-y-1.5 pt-1">
              {mode === 'signin' && (
                <>
                  <p>
                    <button type="button" className="text-brand-600 hover:underline" onClick={() => switchTo('forgot')}>
                      Forgot your password?
                    </button>
                  </p>
                  <p>
                    Working for Elite Solar Care?{' '}
                    <button type="button" className="text-brand-600 hover:underline" onClick={() => switchTo('signup')}>
                      Create an account
                    </button>
                  </p>
                </>
              )}
              {mode !== 'signin' && (
                <button type="button" className="text-brand-600 hover:underline" onClick={() => switchTo('signin')}>
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// Supabase's raw errors are terse. Say what actually went wrong.
function friendly(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password don\'t match. Check for typos, or use "Forgot your password?".'
  if (m.includes('email not confirmed')) return 'Check your email and click the confirmation link first.'
  if (m.includes('already registered')) return 'That email already has an account — sign in instead.'
  if (m.includes('password should be at least')) return 'Pick a longer password (at least 8 characters).'
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Email limit reached. Supabase’s free mail service allows only 2 account emails per hour. Stop retrying, wait up to 1 hour, then request one new link.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can\'t reach the server. Check your internet connection.'
  return message || 'Something went wrong.'
}
