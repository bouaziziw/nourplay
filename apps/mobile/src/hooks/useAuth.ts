import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { api } from '../api'

const TOKEN_KEY = 'nourplay_access_token'
const REFRESH_KEY = 'nourplay_refresh_token'

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
  parentModeUnlocked: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  loginWith2fa: (userId: string, code: string) => Promise<void>
  logout: () => Promise<void>
  unlockParentMode: (password: string) => Promise<void>
  lockParentMode: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useAuthState() {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, loading: true, parentModeUnlocked: false,
  })

  const refreshSession = useCallback(async (): Promise<string | null> => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
      if (!refreshToken) return null
      const res = await api.auth.refresh(refreshToken)
      if (res.accessToken) {
        await SecureStore.setItemAsync(TOKEN_KEY, res.accessToken)
        if (res.refreshToken) {
          await SecureStore.setItemAsync(REFRESH_KEY, res.refreshToken)
        }
        return res.accessToken
      }
      return null
    } catch {
      return null
    }
  }, [])

  const loadUser = useCallback(async (token: string) => {
    try {
      const user = await api.users.me(token)
      await SecureStore.setItemAsync(TOKEN_KEY, token)
      setState({ user, token, loading: false, parentModeUnlocked: false })
    } catch {
      // If access token expired, attempt automatic silent refresh before giving up
      const newToken = await refreshSession()
      if (newToken) {
        try {
          const user = await api.users.me(newToken)
          setState({ user, token: newToken, loading: false, parentModeUnlocked: false })
          return
        } catch {
          // Fall through to logout
        }
      }
      await SecureStore.deleteItemAsync(TOKEN_KEY)
      await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {})
      setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
    }
  }, [refreshSession])

  // Restore token on app launch
  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(async token => {
        if (token) {
          await loadUser(token)
        } else {
          // Try refresh token if access token not present
          const refreshedToken = await refreshSession()
          if (refreshedToken) {
            await loadUser(refreshedToken)
          } else {
            setState(s => ({ ...s, loading: false }))
          }
        }
      })
      .catch(() => setState(s => ({ ...s, loading: false })))
  }, [loadUser, refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (result.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken)
    }
    if (result.accessToken) await loadUser(result.accessToken)
    return result
  }, [loadUser])

  const loginWith2fa = useCallback(async (userId: string, code: string) => {
    const result = await api.auth.loginWith2fa({ userId, code })
    if (result.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken)
    }
    await loadUser(result.accessToken)
  }, [loadUser])

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {})
    setState({ user: null, token: null, loading: false, parentModeUnlocked: false })
  }, [])

  const unlockParentMode = useCallback(async (password: string) => {
    let currentToken = state.token
    if (!currentToken) {
      currentToken = await refreshSession()
    }
    if (!currentToken) throw new Error('Vous devez être connecté pour déverrouiller le mode parent.')

    try {
      await api.auth.verifyParentPassword(currentToken, password)
      setState(current => ({ ...current, token: currentToken, parentModeUnlocked: true }))
    } catch (err) {
      // If 401, refresh token and retry verification
      const refreshedToken = await refreshSession()
      if (refreshedToken) {
        await api.auth.verifyParentPassword(refreshedToken, password)
        setState(current => ({ ...current, token: refreshedToken, parentModeUnlocked: true }))
        return
      }
      throw err
    }
  }, [state.token, refreshSession])

  const lockParentMode = useCallback(() => {
    setState(current => ({ ...current, parentModeUnlocked: false }))
  }, [])

  return { state, login, loginWith2fa, logout, unlockParentMode, lockParentMode }
}
