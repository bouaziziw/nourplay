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
const SESSION_EVENT = 'nourplay:child-session-change'
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function readSessionFromStorage(): ChildSession | null {
  try {
    let raw = localStorage.getItem(SESSION_KEY)
    if (!raw) raw = sessionStorage.getItem(SESSION_KEY)

    if (raw) {
      const parsed = JSON.parse(raw) as ChildSession
      // Check if activated on the same calendar day (daily limits & schedules reset daily)
      const isSameDay = new Date(parsed.activatedAt).toDateString() === new Date().toDateString()
      if (isSameDay) {
        return parsed
      }
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // Storage unavailable (SSR safety)
  }
  return null
}

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

export function isDailyLimitReached(dailyLimitMin: number | null | undefined, watchedSec: number): boolean {
  if (dailyLimitMin == null || dailyLimitMin <= 0) return false
  return Math.floor(watchedSec / 60) >= dailyLimitMin
}

export function useChildSession() {
  const [session, setSessionState] = useState<ChildSession | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const sync = useCallback(() => {
    setSessionState(readSessionFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    sync()

    const onSessionChange = () => sync()
    window.addEventListener('storage', onSessionChange)
    window.addEventListener(SESSION_EVENT, onSessionChange)

    return () => {
      window.removeEventListener('storage', onSessionChange)
      window.removeEventListener(SESSION_EVENT, onSessionChange)
    }
  }, [sync])

  const set = useCallback((s: Omit<ChildSession, 'activatedAt'>) => {
    const full: ChildSession = { ...s, activatedAt: Date.now() }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(full))
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(full))
      window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: full }))
    } catch {}
    setSessionState(full)
  }, [])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: null }))
    } catch {}
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
