'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@nourplay/ui'
import { AuthProvider, useAuth } from '../../hooks/useAuth'

const NAV = [
  { href: '/dashboard', label: 'Vue d\'ensemble', icon: '◈', exact: true, adminOnly: true },
  { href: '/dashboard/moderation', label: 'File de modération', icon: '▶' },
  { href: '/dashboard/moderation/reports', label: 'Signalements', icon: '⚑' },
  { href: '/dashboard/users', label: 'Utilisateurs', icon: '◉', adminOnly: true },
  { href: '/dashboard/compliance', label: 'Conformité RGPD', icon: '⊕', adminOnly: true },
  { href: '/dashboard/legal', label: 'Textes légaux', icon: '§', adminOnly: true },
  { href: '/dashboard/subscriptions', label: 'Abonnements', icon: '★', adminOnly: true },
  { href: '/dashboard/audit', label: 'Journal d\'audit', icon: '≡', adminOnly: true },
]

function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, token, loading, logout } = useAuth()

  useEffect(() => {
    if (!loading && !token) router.replace('/login')
  }, [loading, token, router])

  const isAdmin = user?.role === 'ADMIN'

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const links = NAV.filter(n => !n.adminOnly || isAdmin)

  return (
    <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b border-slate-200/80 bg-white/75 backdrop-blur-md md:h-screen md:w-60 md:border-b-0 md:border-r text-slate-900">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200/80 px-4">
        <Logo size="sm" subtitle="Admin" theme="light" />
      </div>

      {/* Role badge */}
      {user && (
        <div className="hidden border-b border-slate-200/80 px-4 py-4 md:block">
          <p className="truncate text-xs text-slate-600">{user.email}</p>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-red-500/10 text-red-600 border border-red-200' : 'bg-amber-500/10 text-amber-700 border border-amber-200'}`}>
            {user.role}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="min-w-0 flex-1 overflow-x-auto py-2 md:overflow-y-auto md:py-4">
        <div className="flex min-w-max gap-1 px-2 md:min-w-0 md:flex-col">
        {links.map(link => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`mx-0 flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors md:mx-1 ${
                active
                  ? 'bg-[#1c90d8]/10 text-[#1c90d8] border border-[#1c90d8]/30 shadow-xs'
                  : 'text-slate-700 hover:bg-sky-50/60 hover:text-[#1c90d8]'
              }`}
            >
              <span className="w-5 text-center text-base leading-none text-[#1c90d8]">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
        </div>
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mx-3 mb-3 h-10 shrink-0 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        Déconnexion
      </button>
    </aside>
  )
}

function Guard({ children }: { children: React.ReactNode }) {
  const { user, token, loading, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!loading && token && user?.role === 'MODERATOR' && pathname === '/dashboard') {
      router.replace('/dashboard/moderation')
    }
  }, [loading, pathname, router, token, user?.role])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!token) return null

  if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center p-8 bg-white">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-md backdrop-blur-md">
          <h1 className="text-lg font-bold text-slate-900">Accès réservé</h1>
          <p className="mt-2 text-sm text-slate-600">
            Le back-office est réservé aux comptes administrateur et modérateur.
          </p>
          <button
            type="button"
            onClick={async () => {
              await logout()
              router.replace('/login')
            }}
            className="mt-5 h-9 rounded-xl bg-[#1c90d8] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1572ab] shadow-sm"
          >
            Se déconnecter
          </button>
        </div>
      </main>
    )
  }

  if (user.role === 'MODERATOR' && pathname === '/dashboard') {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-white">
        <div className="animate-spin h-8 w-8 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </main>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <Guard>
        <main className="min-w-0 flex-1 overflow-auto bg-white text-slate-900">
          {children}
        </main>
      </Guard>
    </div>
  )
}
