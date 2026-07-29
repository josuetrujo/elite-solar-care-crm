import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { USE_SUPABASE } from '../lib/config'
import { supabase } from '../lib/supabase'
import {
  clearPasswordResetLocation,
  isPasswordResetLocation,
  passwordResetRedirect,
} from '../lib/authUrls'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// In demo mode we auto-sign-in as an admin so the app is usable immediately.
const DEMO_USER = {
  id: 'demo', name: 'Demo Admin', email: 'demo@elitesolarcare.local',
  role: 'admin', approved: true,
}

// Where Supabase should send someone back to after they click a password-reset
// email. Works on localhost and on GitHub Pages because it's built from the
// page's own address rather than hard-coded.
export function resetRedirectUrl() {
  return passwordResetRedirect()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(USE_SUPABASE ? null : DEMO_USER)
  const [loading, setLoading] = useState(USE_SUPABASE)
  // True while the user is inside the "click the email link, set a new
  // password" flow — the app must show the reset screen, not the dashboard.
  const [recovering, setRecovering] = useState(() =>
    typeof window !== 'undefined' && isPasswordResetLocation()
  )

  const loadProfile = useCallback(async (session) => {
    if (!session?.user) return null
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single()
    return {
      id: session.user.id,
      email: session.user.email,
      name: profile?.name || session.user.email,
      role: profile?.role || 'viewer',
      // No profile row yet (the trigger runs a beat behind) counts as
      // not-approved, which is the safe default.
      approved: profile?.approved === true,
    }
  }, [])

  useEffect(() => {
    if (!USE_SUPABASE) return
    let active = true

    async function apply(session) {
      const u = session ? await loadProfile(session) : null
      if (active) { setUser(u); setLoading(false) }
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // PASSWORD_RECOVERY fires when the emailed link is opened. Supabase signs
      // the user in with a short-lived token purely so they can set a password.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      apply(session)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  // Re-read the profile — used right after an admin approves someone, and by
  // the "check again" button on the pending screen.
  async function refresh() {
    if (!USE_SUPABASE) return
    const { data } = await supabase.auth.getSession()
    setUser(await loadProfile(data.session))
  }

  const value = {
    user,
    loading,
    recovering,
    isDemo: !USE_SUPABASE,
    isAdmin: user?.role === 'admin' && user?.approved,
    canEdit: (user?.role === 'admin' || user?.role === 'member') && user?.approved,
    approved: !!user?.approved,
    refresh,
    endRecovery: () => {
      setRecovering(false)
      clearPasswordResetLocation()
    },
    async signIn(email, password) {
      if (!USE_SUPABASE) { setUser(DEMO_USER); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password, name) {
      if (!USE_SUPABASE) { setUser(DEMO_USER); return }
      const { error } = await supabase.auth.signUp({
        email, password, options: { data: { name } },
      })
      if (error) throw error
    },
    // Sends the "reset your password" email.
    async requestPasswordReset(email) {
      if (!USE_SUPABASE) throw new Error('Password reset needs the cloud database (demo mode has no accounts).')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectUrl(),
      })
      if (error) throw error
    },
    // Sets the new password once they're back from the email link.
    async updatePassword(password) {
      if (!USE_SUPABASE) throw new Error('Not available in demo mode.')
      // getSession waits for Supabase to finish consuming the recovery tokens
      // from the URL. This avoids racing updateUser on slower phones/browsers.
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!data.session) throw new Error('Recovery session missing')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    async signOut() {
      if (!USE_SUPABASE) { setUser(null); return }
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
