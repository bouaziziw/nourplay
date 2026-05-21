import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SESSION_KEY = 'nourplay_child_session'

export interface ChildSession {
  profileId: string
  displayName: string
  ageGroup: string
  dailyLimitMin: number | null
  sessionLimitMin: number | null
  viewingSchedule: Record<string, string[]> | null
  activatedAt: number
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function isWithinSchedule(schedule: Record<string, string[]> | null | undefined): boolean {
  if (!schedule) return true
  const now = new Date()
  const dayKey = DAY_KEYS[now.getDay()]
  const slots = schedule[dayKey]
  if (!slots || slots.length === 0) return false
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return slots.some(slot => {
    const [start, end] = slot.split('-')
    return hhmm >= start && hhmm <= end
  })
}

export function sessionElapsedMin(activatedAt: number): number {
  return Math.floor((Date.now() - activatedAt) / 60000)
}

interface ChildSessionContextValue {
  session: ChildSession | null
  hydrated: boolean
  set: (s: Omit<ChildSession, 'activatedAt'>) => Promise<void>
  clear: () => Promise<void>
  isSessionExpired: () => boolean
}

export const ChildSessionContext = createContext<ChildSessionContextValue | null>(null)

export function useChildSession(): ChildSessionContextValue {
  const ctx = useContext(ChildSessionContext)
  if (!ctx) throw new Error('useChildSession must be used inside ChildSessionProvider')
  return ctx
}

export function useChildSessionState(): ChildSessionContextValue {
  const [session, setSession] = useState<ChildSession | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then(raw => {
        if (raw) setSession(JSON.parse(raw) as ChildSession)
      })
      .finally(() => setHydrated(true))
  }, [])

  const set = useCallback(async (s: Omit<ChildSession, 'activatedAt'>) => {
    const full: ChildSession = { ...s, activatedAt: Date.now() }
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(full))
    setSession(full)
  }, [])

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY)
    setSession(null)
  }, [])

  const isSessionExpired = useCallback((): boolean => {
    if (!session) return false
    if (!session.sessionLimitMin) return false
    return sessionElapsedMin(session.activatedAt) >= session.sessionLimitMin
  }, [session])

  return { session, hydrated, set, clear, isSessionExpired }
}
