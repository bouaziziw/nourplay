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
import { useTvNavigation, isTvDevice } from '../../../hooks/useTvNavigation'

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { session, hydrated, clear, isSessionExpired } = useChildSession()
  const { token, loading: authLoading, unlockParentMode } = useAuth()
  const { isTv, showTvHelper } = useTvNavigation()
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
    <div className="min-h-screen bg-[#0b1120] text-white">
      {/* Child header */}
      {token && (
        isTv ? (
          /* Smart TV Cinematic Top Navigation Bar (Directly matching screenshot-tv-1.png & 1000017388.png) */
          <header className="bg-[#070d18]/95 border-b border-white/10 px-6 sm:px-10 h-20 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
            <div className="flex items-center gap-8">
              <Link href={`/${locale}/child/playlists`} tabIndex={0} className="flex items-center gap-3 focus:scale-105 transition-transform">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">NourPlay</span>
              </Link>
              <nav aria-label="Navigation TV" className="flex items-center gap-3">
                <Link
                  href={`/${locale}/child/playlists`}
                  tabIndex={0}
                  className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                    isPlaylistsPage
                      ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/40'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Accueil
                </Link>
                <Link
                  href={`/${locale}/child/playlists`}
                  tabIndex={0}
                  className="px-5 py-2.5 rounded-xl text-sm font-black text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                >
                  Playlists
                </Link>
                <Link
                  href={`/${locale}/child`}
                  tabIndex={0}
                  className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                    isProfileSelector
                      ? 'bg-[#0284c7] text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/40'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  Profils Enfants
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {session && (
                <div className="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-2 border border-white/10 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs font-black text-white shadow">
                    {session.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-black text-white">{session.displayName}</span>
                </div>
              )}
              {/* Mode Parent: Exclusively available on TV */}
              <button
                onClick={() => setUnlockOpen(true)}
                tabIndex={0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 text-sky-300 border border-white/15 transition-all focus:scale-105 focus:ring-2 focus:ring-sky-400"
                title="Accéder au Mode Parent"
              >
                <span>🔒</span>
                <span>Mode Parent</span>
              </button>
            </div>
          </header>
        ) : (
          /* Standard Desktop & Mobile Web Header (Styled in consistent Cinematic Dark Theme, NO Mode Parent) */
          <header className="bg-[#070d18]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between sticky top-0 z-40 shadow-lg">
            <div className="flex items-center gap-6 sm:gap-8">
              <Link href={`/${locale}/child/playlists`} className="flex items-center gap-2.5">
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight">NourPlay</span>
              </Link>
              {session && (
                <nav aria-label="Navigation Enfant" className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href={`/${locale}/child/playlists`}
                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                      isPlaylistsPage
                        ? 'bg-[#0284c7] text-white shadow-md'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Accueil
                  </Link>
                  <Link
                    href={`/${locale}/child/playlists`}
                    className="hidden sm:inline-block px-4 py-2 rounded-xl text-sm font-black text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Playlists
                  </Link>
                  <Link
                    href={`/${locale}/child/favorites`}
                    className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
                      pathname === `/${locale}/child/favorites`
                        ? 'bg-pink-600 text-white shadow-md'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>❤️</span>
                    <span className="hidden sm:inline">Favoris</span>
                  </Link>
                  <Link
                    href={`/${locale}/child`}
                    className={`px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 ${
                      isProfileSelector
                        ? 'bg-[#0284c7] text-white shadow-md'
                        : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>👶</span>
                    <span className="hidden sm:inline">Profils Enfants</span>
                  </Link>
                </nav>
              )}
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {session && (
                <>
                  <ChildCountdownTimer
                    sessionLimitMin={session.sessionLimitMin}
                    dailyLimitMin={session.dailyLimitMin}
                    activatedAt={session.activatedAt}
                    dailyWatchedSec={dailyWatchedSec}
                    onExpire={() => {
                      if (token && session.profileId) {
                        void api.users.notifySessionExpired(token, session.profileId).catch(() => {})
                      }
                      setDailyWatchedSec(prev => (prev ?? 0) + 1)
                    }}
                  />
                  <div className="flex items-center gap-2.5 bg-white/10 rounded-2xl px-3 py-1.5 border border-white/10">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs font-black text-white shadow">
                      {session.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-black text-white hidden sm:inline">{session.displayName}</span>
                  </div>
                  <button
                    onClick={() => { clear(); router.replace(`/${locale}/child`) }}
                    className="text-xs font-bold text-gray-400 hover:text-rose-400 rounded-xl px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    title="Changer de profil enfant"
                  >
                    👶 Changer
                  </button>
                </>
              )}
              {/* NOTE: Mode Parent is intentionally REMOVED on Web & Mobile as requested in Requirement 3 */}
            </div>
          </header>
        )
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
      {isTv && unlockOpen && (
        <ParentUnlockModal onSubmit={handleParentUnlock} onClose={() => setUnlockOpen(false)} />
      )}

      {/* Floating Smart TV Remote Navigation Helper */}
      {showTvHelper && (
        <aside
          aria-label="Aide navigation télécommande TV"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/95 text-white px-5 py-2 text-xs font-black shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-3 pointer-events-none"
        >
          <span className="flex items-center gap-1.5 text-sky-400">
            <span>📺</span>
            <span>Mode TV</span>
          </span>
          <span className="text-gray-500">|</span>
          <span>[▲▼◀▶] Déplacer</span>
          <span className="text-gray-500">|</span>
          <span className="text-emerald-400">[OK] Choisir</span>
          <span className="text-gray-500">|</span>
          <span className="text-amber-300">[Retour] Précédent</span>
        </aside>
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
  const isTv = isTvDevice()
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-sky-950 flex items-center justify-center p-4">
        <div className="text-center text-white max-w-xs">
          <p className="text-5xl mb-4">{title.slice(-2)}</p>
          <h2 className="text-xl font-bold mb-2">{title.slice(0, -2).trim()}</h2>
          <p className="text-sky-200 text-sm mb-8">{message}</p>
          <button
            onClick={onExit}
            data-tv-focus="primary"
            tabIndex={0}
            className="bg-white text-primary font-black px-6 py-3 rounded-2xl hover:bg-sky-50 transition-transform active:scale-95 shadow-xl"
          >
            Retourner au mode enfant
          </button>
          {isTv && (
            <button
              onClick={onParentUnlock}
              data-tv-focus="secondary"
              tabIndex={0}
              className="mt-5 block w-full text-sm font-bold text-sky-300 hover:text-white underline underline-offset-4 focus:ring-2 focus:ring-sky-400 rounded-lg py-1"
            >
              🔒 Mode Parent
            </button>
          )}
        </div>
      </div>
      {isTv && unlockOpen && (
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
