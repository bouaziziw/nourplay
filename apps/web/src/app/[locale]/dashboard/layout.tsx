'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { NotificationBell } from '../../../components/NotificationBell'
import { LocaleSwitcher } from '../../../components/LocaleSwitcher'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Accueil', exact: true, adminOnly: false },
  { href: '/dashboard/playlists', label: 'Playlists', adminOnly: false },
  { href: '/dashboard/videos', label: 'Vidéothèque', adminOnly: false },
  { href: '/dashboard/subscription', label: 'Abonnement', adminOnly: false },
  { href: '/dashboard/approvals', label: 'Approbations', adminOnly: false },
  { href: '/dashboard/privacy', label: 'Confidentialité', adminOnly: false },
  { href: '/dashboard/admin/videos', label: 'Modération', adminOnly: true },
  { href: '/dashboard/admin/sources', label: 'Sources', adminOnly: true },
  { href: '/dashboard/admin/gdpr', label: 'RGPD', adminOnly: true },
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
    <nav className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center justify-between border-b border-gray-200 bg-white/95 px-4 shadow-sm shadow-gray-900/[0.03] backdrop-blur">
      <div className="flex min-h-14 min-w-0 items-center gap-6">
        <Link href={`/${locale}/dashboard`} className="shrink-0 text-lg font-bold tracking-tight text-indigo-600">NourPlay</Link>
        <div className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.filter(link => !link.adminOnly || user?.role === 'ADMIN' || user?.role === 'MODERATOR').map(link => {
            const href = `/${locale}${link.href}`
            const active = link.exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={link.href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="flex min-h-14 items-center gap-2">
        <button
          type="button"
          onClick={() => {
            lockParentMode()
            router.replace(`/${locale}/child`)
          }}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Mode enfant
        </button>
        <LocaleSwitcher mode="select" />
        {token && <NotificationBell token={token} />}
        {user && (
          <Link
            href={`/${locale}/dashboard/account`}
            className="hidden sm:block text-xs text-gray-400 hover:text-gray-700 transition-colors truncate max-w-40"
          >
            {user.email}
          </Link>
        )}
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label="Déconnexion"
            title="Déconnexion"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60 sm:px-3"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H9m4 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">{loggingOut ? 'Déconnexion...' : 'Déconnexion'}</span>
          </button>
        )}
      </div>
      <div className="w-full overflow-x-auto pb-2 sm:hidden">
        <div className="flex min-w-max items-center gap-1">
          {NAV_LINKS.filter(link => !link.adminOnly || user?.role === 'ADMIN' || user?.role === 'MODERATOR').map(link => {
            const href = `/${locale}${link.href}`
            const active = link.exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={link.href}
                href={href}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return children
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ParentModeGuard>
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="w-full px-4 py-8">{children}</main>
      </div>
    </ParentModeGuard>
  )
}
