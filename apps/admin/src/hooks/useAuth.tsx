'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { api, ApiError, setOnTokenUpdate } from '../lib/api'

interface User { id: string; email: string; role: string; locale: string }
interface AuthState { user: User | null; token: string | null; loading: boolean }
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  loginWith2fa: (userId: string, code: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthCtx = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })
  const refreshInFlight = useRef<Promise<void> | null>(null)

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.auth.me(token)
      setState({ user, token, loading: false })
    } catch {
      setState({ user: null, token: null, loading: false })
    }
  }, [])

  const refresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current

    const request = (async () => {
      try {
        const session = await api.auth.refresh()
        if (session?.accessToken) {
          await loadUser(session.accessToken)
        } else {
          setState({ user: null, token: null, loading: false })
        }
      } catch {
        setState({ user: null, token: null, loading: false })
      } finally {
        refreshInFlight.current = null
      }
    })()

    refreshInFlight.current = request
    return request
  }, [loadUser])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    setOnTokenUpdate((newToken: string) => {
      setState(current => current.token === newToken ? current : { ...current, token: newToken })
    })
    return () => setOnTokenUpdate(null)
  }, [])

  useEffect(() => {
    if (!state.token) return
    // Rafraîchir automatiquement le token après 10 minutes (durée de validité : 15 min)
    const timer = setTimeout(() => {
      void refresh()
    }, 10 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [state.token, refresh])

  useEffect(() => {
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && state.token) {
        void refresh()
      }
    }
    window.addEventListener('visibilitychange', onVisibilityOrFocus)
    window.addEventListener('focus', onVisibilityOrFocus)
    return () => {
      window.removeEventListener('visibilitychange', onVisibilityOrFocus)
      window.removeEventListener('focus', onVisibilityOrFocus)
    }
  }, [state.token, refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (result.accessToken) await loadUser(result.accessToken)
    return result
  }, [loadUser])

  const loginWith2fa = useCallback(async (userId: string, code: string) => {
    const { accessToken } = await api.auth.loginWith2fa({ userId, code })
    await loadUser(accessToken)
  }, [loadUser])

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => {})
    setState({ user: null, token: null, loading: false })
  }, [])

  return (
    <AuthCtx.Provider value={{ ...state, login, loginWith2fa, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}
