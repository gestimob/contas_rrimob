import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUserStatus(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUserStatus(session)
    })

    return () => subscription.unsubscribe()
  }, [])
  const checkUserStatus = async (session: Session | null) => {
    if (!session) {
      setSession(null)
      setLoading(false)
      return
    }

    const { data: profile, error } = await supabase
      .from('usuarios_sistema')
      .select('ativo')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()

    if (!profile) {
      // Profile missing - auto-create for first login
      await supabase.from('usuarios_sistema').upsert({
        auth_user_id: session.user.id,
        nome: session.user.email?.split('@')[0] || 'Novo Usuário',
        email: session.user.email || '',
        ativo: true
      }, { onConflict: 'auth_user_id' })
      setSession(session)
    } else if (profile && !profile.ativo) {
      alert('Sua conta está inativa. Entre em contato com o administrador.')
      await supabase.auth.signOut()
      setSession(null)
    } else {
      setSession(session)
    }
    setLoading(false)
  }
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
