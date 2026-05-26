'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { api, ApiError } from '../lib/api'

interface User {
  id: string
  email: string
  role: string
  locale: string
  twoFactorEnabled: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContext extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthCtx = createContext<AuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.users.me(token)
      setState({ user, token, loading: false })
    } catch {
      setState({ user: null, token: null, loading: false })
    }
  }, [])

  const refreshToken = useCallback(async () => {
    try {
      const { accessToken } = await api.auth.refresh()
      await loadUser(accessToken)
    } catch {
      setState({ user: null, token: null, loading: false })
    }
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
    setState({ user: null, token: null, loading: false })
  }

  return (
    <AuthCtx.Provider value={{ ...state, login, logout, refreshToken }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
