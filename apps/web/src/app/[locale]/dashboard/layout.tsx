'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useState, useEffect } from 'react'
import { Logo } from '@nourplay/ui'
import { useAuth } from '../../../hooks/useAuth'
import { NotificationBell } from '../../../components/NotificationBell'
import { LocaleSwitcher } from '../../../components/LocaleSwitcher'

// Liens de navigation principaux conservés dans le header
const HEADER_NAV_LINKS = [
  { href: '/dashboard', label: 'Accueil', exact: true },
  { href: '/dashboard/playlists', label: 'Playlists', exact: false },
  { href: '/dashboard/videos', label: 'Vidéothèque', exact: false },
]

function DashboardNav() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const { user, token, logout, lockParentMode } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    router.replace(`/${locale}/auth/login`)
  }

  return (
    <nav className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center justify-between border-b border-slate-200/80 bg-white/70 px-3 sm:px-6 shadow-xs backdrop-blur-md">
      {/* ── Gauche : Logo & Liens de navigation principaux épurés ── */}
      <div className="flex min-h-14 items-center gap-4 sm:gap-6">
        <Link href={`/${locale}/dashboard`} aria-label="NourPlay" className="shrink-0 hover:opacity-90 transition-opacity">
          <Logo size="sm" subtitle="Parent" theme="light" />
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {HEADER_NAV_LINKS.map(link => {
            const href = `/${locale}${link.href}`
            const active = link.exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={link.href}
                href={href}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                  active ? 'bg-[#1c90d8]/10 text-[#1c90d8] border border-[#1c90d8]/30' : 'text-slate-900 hover:text-[#1c90d8] hover:bg-sky-50/50'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Droite : (Mode Parent, Mode Enfant, Langue, Nom User, Déconnexion) avec icônes compactes & tooltips ── */}
      <div className="flex min-h-14 items-center gap-2 sm:gap-2.5">
        
        {/* 1. Statut Mode Parent avec tooltip */}
        <div className="relative group flex items-center justify-center">
          <div
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-sky-50 text-[#1c90d8] border border-sky-200 text-xs font-bold shadow-xs select-none"
            title="Mode Parent actif"
          >
            <span className="w-2 h-2 rounded-full bg-[#1c90d8] animate-pulse" />
            <svg className="w-3.5 h-3.5 text-[#1c90d8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="hidden md:inline font-bold">Mode Parent</span>
          </div>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-50 pointer-events-none">
            Espace Parent actif 🔒
          </span>
        </div>

        {/* 2. Bouton Mode Enfant compact avec tooltip */}
        <div className="relative group flex items-center justify-center">
          <button
            type="button"
            onClick={() => {
              lockParentMode()
              router.replace(`/${locale}/child`)
            }}
            aria-label="Basculer vers le Mode Enfant"
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs font-bold text-slate-800 hover:text-[#1c90d8] bg-white/80 hover:bg-sky-50 border border-slate-200 rounded-xl transition-all shadow-xs active:scale-95"
          >
            <span className="text-sm">👶</span>
            <span className="hidden md:inline">Mode Enfant</span>
          </button>
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-50 pointer-events-none">
            Basculer vers le Mode Enfant
          </span>
        </div>

        {/* 3. Sélecteur de Langue compact avec tooltip */}
        <div className="relative group flex items-center justify-center">
          <LocaleSwitcher mode="select" />
          <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-50 pointer-events-none">
            Changer de langue
          </span>
        </div>

        {/* Notifications (si connecté) */}
        {token && <NotificationBell token={token} />}

        {/* 4. Nom User / Profil compact avec tooltip */}
        {user && (
          <div className="relative group flex items-center justify-center">
            <Link
              href={`/${locale}/dashboard/account`}
              className="flex items-center gap-2 h-8 px-2 rounded-xl bg-white/80 hover:bg-sky-50 text-slate-800 hover:text-[#1c90d8] transition-colors border border-slate-200 shadow-xs"
              aria-label={`Compte : ${user.email}`}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#1c90d8] to-sky-600 flex items-center justify-center text-[10px] font-black text-white shadow-xs">
                {(user.email || 'U')[0].toUpperCase()}
              </div>
              <span className="hidden lg:inline text-xs font-bold max-w-28 truncate">
                {user.email.split('@')[0]}
              </span>
            </Link>
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-50 pointer-events-none">
              {user.email} (Mon compte)
            </span>
          </div>
        )}

        {/* 5. Bouton Déconnexion compact avec icône & tooltip */}
        {user && (
          <div className="relative group flex items-center justify-center">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Déconnexion"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors shadow-xs disabled:cursor-wait disabled:opacity-60 active:scale-95"
            >
              {loggingOut ? (
                <span className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
            </button>
            <span className="absolute -bottom-8 right-0 hidden group-hover:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-md z-50 pointer-events-none">
              Déconnexion
            </span>
          </div>
        )}
      </div>

      {/* Barre de navigation mobile épurée (Accueil, Playlists, Vidéothèque) */}
      <div className="w-full overflow-x-auto pb-2 sm:hidden border-t border-slate-200/80 pt-2 mt-1">
        <div className="flex items-center gap-1">
          {HEADER_NAV_LINKS.map(link => {
            const href = `/${locale}${link.href}`
            const active = link.exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={link.href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? 'bg-[#1c90d8]/10 text-[#1c90d8] border border-[#1c90d8]/30 font-bold' : 'text-slate-800 hover:bg-sky-50/50'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

function DashboardFooter() {
  const locale = useLocale()
  const pathname = usePathname()
  const { user } = useAuth()

  // Menu déplacé en bas de page comme demandé : Abonnement, Approbations, Confidentialité, Modération, Sources, RGPD
  const FOOTER_LINKS = [
    { href: '/dashboard/subscription', label: 'Abonnement', icon: '💳' },
    { href: '/dashboard/approvals', label: 'Approbations', icon: '✅' },
    { href: '/dashboard/privacy', label: 'Confidentialité', icon: '🛡️' },
    ...(user?.role === 'ADMIN' || user?.role === 'MODERATOR'
      ? [
          { href: '/dashboard/admin/videos', label: 'Modération', icon: '⚖️' },
          { href: '/dashboard/admin/sources', label: 'Sources', icon: '📡' },
          { href: '/dashboard/admin/gdpr', label: 'RGPD', icon: '📋' },
        ]
      : []),
  ]

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/70 backdrop-blur-md py-6 px-4 sm:px-8 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Identité Espace Parent */}
        <div className="flex items-center gap-3">
          <Logo size="xs" subtitle="Parent" theme="light" />
          <span className="text-xs text-slate-500">| Contrôle parental & administration</span>
        </div>

        {/* Liens déplacés en bas de page */}
        <nav aria-label="Gestion parentale et conformité" className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {FOOTER_LINKS.map(link => {
            const href = `/${locale}${link.href}`
            const active = pathname.startsWith(href)
            return (
              <Link
                key={link.href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[#1c90d8]/10 text-[#1c90d8] font-bold border border-[#1c90d8]/30'
                    : 'text-slate-700 hover:text-[#1c90d8] hover:bg-sky-50/50 border border-transparent'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Copyright */}
        <div className="text-xs text-slate-500 font-medium">
          © {new Date().getFullYear()} NourPlay
        </div>
      </div>
    </footer>
  )
}

function ParentModeGuard({ children }: { children: React.ReactNode }) {
  const { token, loading, parentModeUnlocked } = useAuth()
  const locale = useLocale()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!token) router.replace(`/${locale}/auth/login`)
    else if (!parentModeUnlocked) router.replace(`/${locale}/child`)
  }, [loading, token, parentModeUnlocked, locale, router])

  if (loading || !token || !parentModeUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent" />
      </div>
    )
  }

  return children
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentModeGuard>
      <div className="min-h-screen flex flex-col bg-white text-slate-900">
        <DashboardNav />
        <main className="w-full flex-1 px-4 py-8 bg-white">{children}</main>
        <DashboardFooter />
      </div>
    </ParentModeGuard>
  )
}
