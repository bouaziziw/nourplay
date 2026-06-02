'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AuthProvider, useAuth } from '../../hooks/useAuth'

const NAV = [
  { href: '/dashboard', label: 'Vue d\'ensemble', icon: '◈', exact: true },
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
    <aside className="w-56 shrink-0 bg-gray-900 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-800">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center mr-2.5">
          <span className="text-white font-black text-sm">N</span>
        </div>
        <span className="text-white font-bold text-sm">NourPlay Admin</span>
      </div>

      {/* Role badge */}
      {user && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${isAdmin ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {user.role}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3">
        {links.map(link => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors mx-2 rounded-lg mb-0.5 ${
                active
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <span className="text-base leading-none">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mx-4 mb-4 h-9 text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg transition-colors"
      >
        Déconnexion
      </button>
    </aside>
  )
}

function Guard({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }
  if (!token) return null
  return <>{children}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <Guard>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </Guard>
      </div>
    </AuthProvider>
  )
}
