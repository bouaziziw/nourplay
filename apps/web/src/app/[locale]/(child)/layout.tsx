'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AuthProvider, useAuth } from '../../../hooks/useAuth'
import { useChildSession, isWithinSchedule, sessionElapsedMin, isDailyLimitReached } from '../../../hooks/useChildSession'
import { api } from '../../../lib/api'

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { session, hydrated, clear, isSessionExpired } = useChildSession()
  const { token } = useAuth()
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const [dailyWatchedSec, setDailyWatchedSec] = useState<number | null>(null)

  // Redirect to profile selector if no active session (but allow the selector page itself)
  const isProfileSelector = pathname === `/${locale}/child`

  useEffect(() => {
    if (!hydrated) return
    if (!session && !isProfileSelector) {
      router.replace(`/${locale}/child`)
    }
  }, [hydrated, session, isProfileSelector, router, locale])

  // Fetch daily watch time on session load; re-poll every 60s
  useEffect(() => {
    if (!token || !session) return
    const profileId = session.profileId
    const fetch = async () => {
      try {
        const { watchedSec } = await api.users.getDailyWatchTime(token, profileId)
        setDailyWatchedSec(watchedSec)
      } catch {
        // Fail open — don't block if the API is unavailable
      }
    }
    fetch()
    const interval = setInterval(fetch, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session?.profileId])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Schedule / session-limit blocking screen (only when a session is active)
  if (session && !isProfileSelector) {
    if (!isWithinSchedule(session.viewingSchedule)) {
      return (
        <BlockingScreen
          title="Pas maintenant 🌙"
          message="La lecture vidéo n'est pas disponible à cette heure."
          onExit={() => { clear(); router.replace(`/${locale}/dashboard`) }}
        />
      )
    }

    if (isSessionExpired()) {
      return (
        <BlockingScreen
          title="Temps écoulé ⏰"
          message={`La session de ${session.displayName} est terminée pour aujourd'hui.`}
          onExit={() => { clear(); router.replace(`/${locale}/dashboard`) }}
        />
      )
    }

    if (dailyWatchedSec !== null && isDailyLimitReached(session.dailyLimitMin, dailyWatchedSec)) {
      return (
        <BlockingScreen
          title="Objectif du jour atteint 🌟"
          message={`${session.displayName} a atteint sa limite de visionnage pour aujourd'hui. À demain !`}
          onExit={() => { clear(); router.replace(`/${locale}/dashboard`) }}
        />
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Child header */}
      {session && (
        <header className="bg-white/80 backdrop-blur-sm border-b border-white/50 px-4 h-14 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
              {session.displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="font-semibold text-gray-800 text-sm">{session.displayName}</span>
            <Link
              href={`/${locale}/child/favorites`}
              title="Mes favoris"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {session.dailyLimitMin && dailyWatchedSec !== null && (
              <span className="text-xs text-gray-400">
                {Math.max(0, session.dailyLimitMin - Math.floor(dailyWatchedSec / 60))} min / jour
              </span>
            )}
            {session.sessionLimitMin && (
              <span className="text-xs text-gray-400">
                {Math.max(0, session.sessionLimitMin - sessionElapsedMin(session.activatedAt))} min session
              </span>
            )}
            <button
              onClick={() => { clear(); router.replace(`/${locale}/dashboard`) }}
              className="text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-2.5 py-1 transition-colors"
            >
              Quitter
            </button>
          </div>
        </header>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

function BlockingScreen({ title, message, onExit }: { title: string; message: string; onExit: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="text-center text-white max-w-xs">
        <p className="text-5xl mb-4">{title.slice(-2)}</p>
        <h2 className="text-xl font-bold mb-2">{title.slice(0, -2).trim()}</h2>
        <p className="text-indigo-200 text-sm mb-8">{message}</p>
        <button
          onClick={onExit}
          className="bg-white text-indigo-900 font-semibold px-6 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          Retourner au tableau de bord
        </button>
      </div>
    </div>
  )
}

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ChildGuard>
        {children}
      </ChildGuard>
    </AuthProvider>
  )
}
