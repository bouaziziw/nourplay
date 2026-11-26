'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Logo } from '@nourplay/ui'
import { useAuth } from '../../../hooks/useAuth'
import { useChildSession, isWithinSchedule, isDailyLimitReached } from '../../../hooks/useChildSession'
import { api } from '../../../lib/api'
import { ParentUnlockModal } from '../../../components/ParentUnlockModal'
import { ChildCountdownTimer } from '../../../components/ChildCountdownTimer'
import { useTvNavigation } from '../../../hooks/useTvNavigation'

function ChildGuard({ children }: { children: React.ReactNode }) {
  const { session, hydrated, clear, updateViewingBlocked, isSessionExpired } = useChildSession()
  const { token, loading: authLoading, unlockParentMode, parentModeUnlocked } = useAuth()
  const { isTv, showTvHelper } = useTvNavigation()
  const router = useRouter()
  const locale = useLocale()
  const pathname = usePathname()
  const [dailyWatchedSec, setDailyWatchedSec] = useState<number | null>(null)
  const [isViewingBlocked, setIsViewingBlocked] = useState<boolean>(Boolean(session?.isViewingBlocked))
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)

  const isProfileSelector = pathname === `/${locale}/child`
  const isPlaylistsPage = pathname === `/${locale}/child/playlists`

  useEffect(() => {
    document.documentElement.classList.add('child-theme')
    document.body.classList.add('child-theme')
    return () => {
      document.documentElement.classList.remove('child-theme')
      document.body.classList.remove('child-theme')
    }
  }, [])

  useEffect(() => {
    if (authLoading || isUnlocking || parentModeUnlocked) return
    if (!token) {
      router.replace(`/${locale}/auth/login`)
      return
    }
    if (!hydrated) return
    if (!session && !isProfileSelector) {
      router.replace(`/${locale}/child`)
    }
  }, [authLoading, isUnlocking, parentModeUnlocked, token, hydrated, session, isProfileSelector, router, locale])

  const handleParentUnlock = async (secret: string) => {
    setIsUnlocking(true)
    try {
      await unlockParentMode(secret)
      const targetProfileId = session?.profileId
      if (targetProfileId && token && (isViewingBlocked || session?.isViewingBlocked)) {
        try {
          await api.users.setViewingBlocked(token, targetProfileId, false)
          updateViewingBlocked(false)
          setIsViewingBlocked(false)
        } catch {
          // ignore if backend call fails
        }
      }
      if (targetProfileId) {
        router.replace(`/${locale}/dashboard/profiles/${targetProfileId}`)
      } else {
        router.replace(`/${locale}/dashboard`)
      }
    } catch (err) {
      setIsUnlocking(false)
      throw err
    }
  }

  useEffect(() => {
    const handleOpenUnlock = () => setUnlockOpen(true)
    window.addEventListener('nourplay:open-parent-unlock', handleOpenUnlock)
    return () => window.removeEventListener('nourplay:open-parent-unlock', handleOpenUnlock)
  }, [])

  useEffect(() => {
    if (session?.isViewingBlocked !== undefined) {
      setIsViewingBlocked(Boolean(session.isViewingBlocked))
    }
  }, [session?.isViewingBlocked])

  useEffect(() => {
    const profileId = session?.profileId
    if (!token || !profileId) return
    const fetchStatus = async () => {
      try {
        const res = await api.users.getDailyWatchTime(token, profileId)
        setDailyWatchedSec(res.watchedSec)
        if (res.isViewingBlocked !== undefined) {
          setIsViewingBlocked(res.isViewingBlocked)
          if (res.isViewingBlocked !== session?.isViewingBlocked) {
            updateViewingBlocked(res.isViewingBlocked)
          }
        }
      } catch {
        // Fail open
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 10_000)
    const onFocus = () => { void fetchStatus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [token, session?.profileId, session?.isViewingBlocked, updateViewingBlocked])

  if (authLoading || !token || !hydrated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-sky-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (session && !isProfileSelector) {
    if (isViewingBlocked || session.isViewingBlocked) {
      return (
        <BlockingScreen
          title="Visionnage interrompu ⏸️"
          message="Le visionnage a été mis en pause par un parent."
          onExit={() => { clear(); router.replace(`/${locale}/child`) }}
          onParentUnlock={() => setUnlockOpen(true)}
          unlockOpen={unlockOpen}
          onUnlockClose={() => setUnlockOpen(false)}
          onUnlockSubmit={handleParentUnlock}
        />
      )
    }

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
    <div className="min-h-screen bg-white text-black selection:bg-sky-500 selection:text-white relative">
      {/* ── Top Navigation Bar : Harmonized Header matching screenshot-tv-1.png ── */}
      {token && (
        <header className="bg-white/95 border-b border-slate-200/80 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          {/* Gauche : Logo NourPlay existant & Liens de navigation (Accueil, Playlists, Profils Enfants) */}
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href={`/${locale}/child/playlists`} className="shrink-0 flex items-center gap-2 hover:opacity-95 transition-opacity">
              <Logo size="sm" theme="light" />
            </Link>

            {session && (
              <nav aria-label="Navigation Enfant" className="flex items-center gap-2 sm:gap-4">
                <Link
                  href={`/${locale}/child/playlists`}
                  className={`text-sm sm:text-base font-bold transition-all px-4 py-1.5 rounded-lg ${
                    isPlaylistsPage
                      ? 'bg-[#0284c7] text-white shadow-sm'
                      : 'text-black hover:text-[#1c90d8]'
                  }`}
                >
                  Accueil
                </Link>
                <Link
                  href={`/${locale}/child/playlists`}
                  className={`text-sm sm:text-base font-bold transition-colors px-2.5 py-1.5 ${
                    pathname.startsWith(`/${locale}/child/playlists/`)
                      ? 'text-[#1c90d8]'
                      : 'text-black hover:text-[#1c90d8]'
                  }`}
                >
                  Playlists
                </Link>
                <Link
                  href={`/${locale}/child`}
                  className={`text-sm sm:text-base font-bold transition-colors px-2.5 py-1.5 ${
                    isProfileSelector
                      ? 'text-[#1c90d8]'
                      : 'text-black hover:text-[#1c90d8]'
                  }`}
                >
                  Profils Enfants
                </Link>
              </nav>
            )}
          </div>

          {/* Droite : Timer conditionnel, Mon profil, Mode Parent */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {session && (
              <>
                {/* Timer conditionnel : affiché UNIQUEMENT si activé par le parent */}
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

                {/* Badge Profil Enfant */}
                <div className="flex items-center gap-2 text-black pl-1 sm:pl-2">
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1c90d8] border border-[#1c90d8]/30 flex items-center justify-center text-xs sm:text-sm font-black text-white shadow-sm"
                    title={session.displayName}
                  >
                    {session.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-black hidden sm:inline">
                    {session.displayName}
                  </span>
                </div>
              </>
            )}

            {/* Bouton Mode Parent : toujours accessible et visible avec son style et son comportement d'origine */}
            <button
              onClick={() => setUnlockOpen(true)}
              tabIndex={0}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-[#1c90d8] hover:bg-[#1479be] text-white border border-[#1c90d8]/20 transition-all shadow-md active:scale-95"
              title="Accéder au Mode Parent"
            >
              <span>🔒</span>
              <span>Mode Parent</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        className={
          isPlaylistsPage
            ? 'mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8'
            : 'w-full max-w-none mx-auto px-4 py-6'
        }
      >
        {children}
      </main>

      {/* Modal Déverrouillage Mode Parent */}
      {unlockOpen && (
        <ParentUnlockModal onSubmit={handleParentUnlock} onClose={() => setUnlockOpen(false)} />
      )}

      {/* Helper Télécommande TV */}
      {isTv && showTvHelper && (
        <aside
          aria-label="Aide navigation télécommande TV"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/90 text-white px-5 py-2 text-xs font-black shadow-2xl backdrop-blur-md border border-white/20 flex items-center gap-3 pointer-events-none"
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
  const locale = useLocale()
  return (
    <>
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center text-slate-900 max-w-sm bg-white p-8 rounded-3xl border border-slate-200 shadow-xl backdrop-blur-md">
          <p className="text-5xl mb-4">{title.slice(-2)}</p>
          <h2 className="text-xl font-bold mb-2 text-slate-900">{title.slice(0, -2).trim()}</h2>
          <p className="text-slate-600 text-sm mb-6">{message}</p>

          {/* Bouton principal : Accéder au Mode Parent */}
          <button
            onClick={onParentUnlock}
            data-tv-focus="primary"
            tabIndex={0}
            className="w-full bg-[#1c90d8] hover:bg-[#1572ad] text-white font-black px-6 py-3 rounded-2xl transition-transform active:scale-95 shadow-xl flex items-center justify-center gap-2"
          >
            <span>🔒</span>
            <span>Accéder au Mode Parent</span>
          </button>

          {/* Bouton secondaire : Changer de profil */}
          <button
            onClick={onExit}
            data-tv-focus="secondary"
            tabIndex={0}
            className="mt-3 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            Changer de profil
          </button>

          {/* Lien de secours : Page de connexion */}
          <Link
            href={`/${locale}/auth/login`}
            className="mt-4 block text-xs font-semibold text-slate-500 hover:text-[#1c90d8] underline underline-offset-2 transition-colors"
          >
            Se connecter avec un autre compte
          </Link>
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
