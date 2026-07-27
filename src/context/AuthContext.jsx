import { createContext, useContext, useEffect, useState } from 'react'
import { USE_SUPABASE } from '../lib/config'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// In demo mode we auto-sign-in as an admin so the app is usable immediately.
const DEMO_USER = { id: 'demo', name: 'Demo Admin', email: 'demo@elitesolarcare.local', role: 'admin' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(USE_SUPABASE ? null : DEMO_USER)
  const [loading, setLoading] = useState(USE_SUPABASE)

  useEffect(() => {
    if (!USE_SUPABASE) return
    let active = true

    async function loadProfile(session) {
      if (!session?.user) {
        if (active) { setUser(null); setLoading(false) }
        return
      }
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', session.user.id).single()
      if (active) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: profile?.name || session.user.email,
          role: profile?.role || 'member',
        })
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => loadProfile(session))
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const value = {
    user,
    loading,
    isDemo: !USE_SUPABASE,
    isAdmin: user?.role === 'admin',
    canEdit: user?.role === 'admin' || user?.role === 'member',
    async signIn(email, password) {
      if (!USE_SUPABASE) { setUser(DEMO_USER); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password, name) {
      if (!USE_SUPABASE) { setUser(DEMO_USER); return }
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
      if (error) throw error
    },
    async signOut() {
      if (!USE_SUPABASE) { setUser(null); return }
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
