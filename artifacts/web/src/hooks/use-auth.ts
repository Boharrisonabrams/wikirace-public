import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase/client'

interface AuthState {
  user: User | null
  loading: boolean
}

/** Current Supabase user, kept in sync with auth state changes. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    let cancelled = false
    const supabase = getSupabase()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setState({ user: session?.user ?? null, loading: false })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState({ user: session?.user ?? null, loading: false })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}
