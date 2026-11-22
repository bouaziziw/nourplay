'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Logo } from '@nourplay/ui'
import { useAuth } from '../../../hooks/useAuth'
import { useChildSession, isWithinSchedule, sessionElapsedMin, isDailyLimitReached } from '../../../hooks/useChildSession'
import { api } from '../../../lib/api'
import { ParentUnlockModal } from '../../../components/ParentUnlockModal'
import { ChildCountdownTimer } from '../../../components/ChildCountdownTimer'

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { session, hydrated, clear, isSessionExpired } = useChildSession()
  const { token, loading: authLoading, unlockParentMode } = useAuth()
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const [dailyWatchedSec, setDailyWatchedSec] = useState<number | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)

  // Redirect to profile selector if no active session (but allow the selector page itself)
  const isProfileSelector = pathname === `/${locale}/child`
  const isPlaylistsPage = pathname === `/${locale}/child/playlists`

  useEffect(() => {
    if (authLoading || isUnlocking) return
    if (!token) {
      router.replace(`/${locale}/auth/login`)
      return
    }
    if (!hydrated) return
    if (!session && !isProfileSelector) {
      router.replace(`/${locale}/child`)
    }
  }, [authLoading, isUnlocking, token, hydrated, session, isProfileSelector, router, locale])

  const handleParentUnlock = async (password: string) => {
    setIsUnlocking(true)
    await unlockParentMode(password)
    await clear()
    router.push(`/${locale}/dashboard`)
  }

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

  if (authLoading || !token || !hydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
          onExit={() => { clear(); router.replace(`/${locale}/child`) }}
          onParentUnlock={() => setUnlockOpen(true)}
          unlockOpen={unlockOpen}
          onUnlockClose={() => setUnlockOpen(false)}
          onUnlockSubmit={handleParentUnlock}
        />
      )
    }

    if (isSessionExpired()) {
      return (
        <BlockingScreen
          title="Temps écoulé ⏰"
          message={`La session de ${session.displayName} est terminée pour aujourd'hui.`}
          onExit={() => { clear(); router.replace(`/${locale}/child`) }}
          onParentUnlock={() => setUnlockOpen(true)}
          unlockOpen={unlockOpen}
          onUnlockClose={() => setUnlockOpen(false)}
          onUnlockSubmit={handleParentUnlock}
        />
      )
    }

    if (dailyWatchedSec !== null && isDailyLimitReached(session.dailyLimitMin, dailyWatchedSec)) {
      return (
        <BlockingScreen
          title="Objectif du jour atteint 🌟"
          message={`${session.displayName} a atteint sa limite de visionnage pour aujourd'hui. À demain !`}
          onExit={() => { clear(); router.replace(`/${locale}/child`) }}
          onParentUnlock={() => setUnlockOpen(true)}
          unlockOpen={unlockOpen}
          onUnlockClose={() => setUnlockOpen(false)}
          onUnlockSubmit={handleParentUnlock}
        />
      )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      {/* Child header */}
      {token && (
        <header className="bg-white/90 backdrop-blur-md border-b border-sky-100 px-4 h-16 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <Link href={`/${locale}/child/playlists`} className="flex items-center gap-2.5">
                  <Logo size="xs" showText={false} />
                  <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center text-sm font-black text-white shadow-sm">
                    {session.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-extrabold text-gray-900 text-sm hidden sm:inline">{session.displayName}</span>
                </Link>
              </>
            ) : (
              <Logo size="sm" subtitle="Enfant" />
            )}
            {session && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
                <Link
                  href={`/${locale}/child/playlists`}
                  title="Toutes les chaînes"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-50 text-[#1c90d8] font-black text-xs hover:bg-sky-100 transition-colors shadow-xs"
                >
                  <span>📺</span>
                  <span className="hidden md:inline">Chaînes</span>
                </Link>
                <Link
                  href={`/${locale}/child/favorites`}
                  title="Mes favoris"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-pink-500 hover:bg-pink-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </Link>
                <Link
                  href={`/${locale}/child/history`}
                  title="Mon historique"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {session && (
              <ChildCountdownTimer
                sessionLimitMin={session.sessionLimitMin}
                dailyLimitMin={session.dailyLimitMin}
                activatedAt={session.activatedAt}
                dailyWatchedSec={dailyWatchedSec}
                onExpire={() => {
                  if (token && session.profileId) {
                    void api.users.notifySessionExpired(token, session.profileId).catch(() => {})
                  }
                  // Force re-render to trigger blocking screen
                  setDailyWatchedSec(prev => (prev ?? 0) + 1)
                }}
              />
            )}
            <button
              onClick={() => setUnlockOpen(true)}
              className="text-xs font-black text-gray-700 hover:text-[#1c90d8] hover:bg-sky-50 border border-gray-200 hover:border-sky-200 rounded-xl px-3 py-1.5 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>🔒</span>
              <span className="hidden sm:inline">Parents</span>
            </button>
            {session && (
              <button
                onClick={() => { clear(); router.replace(`/${locale}/child`) }}
                className="text-xs font-bold text-gray-400 hover:text-rose-500 rounded-xl px-2 py-1.5 transition-colors"
                title="Changer de profil"
              >
                👶
              </button>
            )}
          </div>
        </header>
      )}

      <main
        className={
          isPlaylistsPage
            ? 'mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8'
            : 'w-full max-w-none mx-auto px-4 py-6'
        }
      >
        {children}
      </main>
      {unlockOpen && (
        <ParentUnlockModal onSubmit={handleParentUnlock} onClose={() => setUnlockOpen(false)} />
      )}
    </div>
  )
}

function BlockingScreen({
  title,
  message,
  onExit,
  onParentUnlock,
  unlockOpen,
  onUnlockClose,
  onUnlockSubmit,
}: {
  title: string
  message: string
  onExit: () => void
  onParentUnlock: () => void
  unlockOpen: boolean
  onUnlockClose: () => void
  onUnlockSubmit: (password: string) => Promise<void>
}) {
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-sky-950 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-xs">
          <p className="text-5xl mb-4">{title.slice(-2)}</p>
          <h2 className="text-xl font-bold mb-2">{title.slice(0, -2).trim()}</h2>
          <p className="text-sky-200 text-sm mb-8">{message}</p>
          <button
            onClick={onExit}
            className="bg-white text-primary font-semibold px-6 py-2.5 rounded-xl hover:bg-sky-50 transition-colors"
          >
            Retourner au mode enfant
          </button>
          <button
            onClick={onParentUnlock}
            className="mt-4 block w-full text-sm font-medium text-white underline underline-offset-4"
          >
            Mode Parent
          </button>
        </div>
      </div>
      {unlockOpen && (
        <ParentUnlockModal onSubmit={onUnlockSubmit} onClose={onUnlockClose} />
      )}
    </>
  )
}

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChildGuard>
      {children}
    </ChildGuard>
  )
}
