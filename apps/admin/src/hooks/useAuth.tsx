'use client'

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { api, ApiError } from '../lib/api'

interface User { id: string; email: string; role: string; locale: string }
interface AuthState { user: User | null; token: string | null; loading: boolean }
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  loginWith2fa: (userId: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthCtx = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.auth.me(token)
      setState({ user, token, loading: false })
    } catch {
      setState({ user: null, token: null, loading: false })
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const { accessToken } = await api.auth.refresh()
      await loadUser(accessToken)
    } catch {
      setState({ user: null, token: null, loading: false })
    }
  }, [loadUser])

  useEffect(() => { refresh() }, [refresh])

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
    <AuthCtx.Provider value={{ ...state, login, loginWith2fa, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}
