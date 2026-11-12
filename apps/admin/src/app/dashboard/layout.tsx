'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
    <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b border-gray-800 bg-gray-900 md:h-screen md:w-60 md:border-b-0 md:border-r">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-800 px-4">
        <div className="mr-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-950/40">
          <span className="text-white font-black text-sm">N</span>
        </div>
        <span className="text-sm font-bold tracking-tight text-white">NourPlay <span className="text-indigo-300">Admin</span></span>
      </div>

      {/* Role badge */}
      {user && (
        <div className="hidden border-b border-gray-800 px-4 py-4 md:block">
          <p className="truncate text-xs text-gray-400">{user.email}</p>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
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
              className={`mx-0 flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:mx-1 ${
                active
                  ? 'bg-indigo-600/20 text-indigo-300 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <span className="w-5 text-center text-base leading-none">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
        </div>
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mx-3 mb-3 h-10 shrink-0 rounded-lg border border-gray-700 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-white"
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!token) return null

  if (user?.role !== 'ADMIN' && user?.role !== 'MODERATOR') {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
          <h1 className="text-lg font-semibold text-white">Accès réservé</h1>
          <p className="mt-2 text-sm text-gray-400">
            Le back-office est réservé aux comptes administrateur et modérateur.
          </p>
          <button
            type="button"
            onClick={async () => {
              await logout()
              router.replace('/login')
            }}
            className="mt-5 h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Se déconnecter
          </button>
        </div>
      </main>
    )
  }

  if (user.role === 'MODERATOR' && pathname === '/dashboard') {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </main>
    )
  }

  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-gray-950 md:flex-row">
        <Sidebar />
        <Guard>
          <main className="min-w-0 flex-1 overflow-auto">
            {children}
          </main>
        </Guard>
      </div>
    </AuthProvider>
  )
}
