import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { api } from '../api'

const TOKEN_KEY = 'nourplay_access_token'

interface User {
  id: string
  email: string
  role: string
  locale: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  loginWith2fa: (userId: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({ user: null, token: null, loading: true })

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.users.me(token)
      await SecureStore.setItemAsync(TOKEN_KEY, token)
      setState({ user, token, loading: false })
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      setState({ user: null, token: null, loading: false })
    }
  }, [])

  // Restore token on app launch
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(token => {
        if (token) return loadUser(token)
        setState(s => ({ ...s, loading: false }))
      })
      .catch(() => setState(s => ({ ...s, loading: false })))
  }, [loadUser])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (result.accessToken) await loadUser(result.accessToken)
    return result
  }, [loadUser])

  const loginWith2fa = useCallback(async (userId: string, code: string) => {
    const result = await api.auth.loginWith2fa({ userId, code })
    await loadUser(result.accessToken)
  }, [loadUser])

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    setState({ user: null, token: null, loading: false })
  }, [])

  return { state, login, loginWith2fa, logout }
}
