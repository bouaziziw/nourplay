'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AuthProvider, useAuth } from '../../../hooks/useAuth'
import { NotificationBell } from '../../../components/NotificationBell'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Accueil', exact: true },
  { href: '/dashboard/playlists', label: 'Playlists' },
  { href: '/dashboard/videos', label: 'Vidéothèque' },
]

function DashboardNav() {
  const locale = useLocale()
  const pathname = usePathname()
  const { user, token } = useAuth()

  return (
    <nav className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <Link href={`/${locale}/dashboard`} className="text-lg font-bold text-indigo-600">NourPlay</Link>
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(link => {
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
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/child`}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Mode enfant
        </Link>
        {token && <NotificationBell token={token} />}
        {user && (
          <Link
            href={`/${locale}/dashboard/account`}
            className="hidden sm:block text-xs text-gray-400 hover:text-gray-700 transition-colors truncate max-w-40"
          >
            {user.email}
          </Link>
        )}
      </div>
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <DashboardNav />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </div>
    </AuthProvider>
  )
}
