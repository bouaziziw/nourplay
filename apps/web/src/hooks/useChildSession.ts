'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ChildSession {
  profileId: string
  displayName: string
  ageGroup: string
  dailyLimitMin: number | null
  sessionLimitMin: number | null
  viewingSchedule: Record<string, string[]> | null
  activatedAt: number
}

const SESSION_KEY = 'nourplay_child_session'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function isWithinSchedule(schedule: Record<string, string[]> | null | undefined): boolean {
  if (!schedule) return true
  const day = DAY_KEYS[new Date().getDay()]
  const slots = schedule[day]
  if (!slots?.length) return false
  const now = new Date()
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return slots.some(slot => {
    const [start, end] = slot.split('-')
    return current >= start && current <= end
  })
}

export function sessionElapsedMin(activatedAt: number): number {
  return Math.floor((Date.now() - activatedAt) / 60000)
}

export function useChildSession() {
  const [session, setSessionState] = useState<ChildSession | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (raw) setSessionState(JSON.parse(raw) as ChildSession)
    } catch {
      // sessionStorage unavailable (SSR safety)
    }
    setHydrated(true)
  }, [])

  const set = useCallback((s: Omit<ChildSession, 'activatedAt'>) => {
    const full: ChildSession = { ...s, activatedAt: Date.now() }
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(full)) } catch {}
    setSessionState(full)
  }, [])

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    setSessionState(null)
  }, [])

  const isSessionExpired = useCallback((): boolean => {
    if (!session) return false
    const { sessionLimitMin, activatedAt } = session
    if (!sessionLimitMin) return false
    return sessionElapsedMin(activatedAt) >= sessionLimitMin
  }, [session])

  return { session, hydrated, set, clear, isSessionExpired }
}
