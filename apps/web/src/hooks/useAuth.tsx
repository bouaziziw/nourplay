'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { api, ApiError, setOnTokenUpdate } from '../lib/api'

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
      void refreshToken()
    }, 10 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [state.token, refreshToken])

  const login = async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (result.requiresTwoFactor) return result
    if (result.accessToken) await loadUser(result.accessToken)
    return result
  }

  const logout = async () => {
    if (state.token) await api.auth.logout(state.token).catch(() => {})
    setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
  }

  const setToken = useCallback(async (token: string) => {
    await loadUser(token)
  }, [loadUser])

  const unlockParentMode = useCallback(async (password: string) => {
    let currentToken = state.token
    if (!currentToken) {
      const session = await api.auth.refresh().catch(() => null)
      if (session?.accessToken) {
        currentToken = session.accessToken
        await loadUser(currentToken)
      }
    }
    if (!currentToken) throw new Error('Vous devez être connecté pour déverrouiller le mode parent.')

    try {
      await api.auth.verifyParentPassword(currentToken, password)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.message !== 'Mot de passe incorrect') {
        const session = await api.auth.refresh().catch(() => null)
        if (session?.accessToken) {
          await loadUser(session.accessToken)
          await api.auth.verifyParentPassword(session.accessToken, password)
          setState(current => ({ ...current, parentModeUnlocked: true }))
          return
        }
      }
      throw err
    }
    setState(current => ({ ...current, parentModeUnlocked: true }))
  }, [state.token, loadUser])

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
