'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { api } from '../lib/api'

interface User {
  id: string
  email: string
  role: string
  locale: string
  weeklyDigestEnabled: boolean
  twoFactorEnabled: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  parentModeUnlocked: boolean
}

interface AuthContext extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  setToken: (token: string) => Promise<void>
  unlockParentMode: (password: string) => Promise<void>
  lockParentMode: () => void
}

const AuthCtx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, loading: true, parentModeUnlocked: false,
  })
  const refreshInFlight = useRef<Promise<void> | null>(null)

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.users.me(token)
      setState({ user, token, loading: false, parentModeUnlocked: false })
    } catch {
      setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
    }
  }, [])

  const refreshToken = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current

    const refresh = (async () => {
      try {
        const session = await api.auth.refresh()
        if (session) {
          await loadUser(session.accessToken)
        } else {
          setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
        }
      } catch {
        setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
      }

      refreshInFlight.current = null
    })()

    refreshInFlight.current = refresh
    return refresh
  }, [loadUser])

  useEffect(() => { refreshToken() }, [refreshToken])

  const login = async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (result.requiresTwoFactor) return result
    if (result.accessToken) await loadUser(result.accessToken)
    return result
  }

  const logout = async () => {
    await api.auth.logout().catch(() => {})
    setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
  }

  const setToken = useCallback(async (token: string) => {
    await loadUser(token)
  }, [loadUser])

  const unlockParentMode = useCallback(async (password: string) => {
    if (!state.token) throw new Error('Vous devez être connecté pour déverrouiller le mode parent.')
    await api.auth.verifyParentPassword(state.token, password)
    setState(current => ({ ...current, parentModeUnlocked: true }))
  }, [state.token])

  const lockParentMode = useCallback(() => {
    setState(current => ({ ...current, parentModeUnlocked: false }))
  }, [])

  return (
    <AuthCtx.Provider value={{ ...state, login, logout, refreshToken, setToken, unlockParentMode, lockParentMode }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
