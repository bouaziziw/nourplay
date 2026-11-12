'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../hooks/useAuth'
import { api, AdminUser } from '../../../lib/api'

const ROLES = ['ADMIN', 'MODERATOR', 'TEACHER', 'PARENT']

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/20 text-red-400',
  MODERATOR: 'bg-amber-500/20 text-amber-400',
  TEACHER: 'bg-sky-500/20 text-sky-400',
  PARENT: 'bg-indigo-500/20 text-indigo-400',
}

export default function UsersPage() {
  const { token } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const LIMIT = 25

  const load = useCallback((p = 1, q = search, r = role, del = showDeleted) => {
    if (!token) return
    setLoading(true)
    api.admin.getUsers(token, { page: p, limit: LIMIT, search: q || undefined, role: r || undefined, deleted: del || undefined })
      .then(res => { setUsers(res.items); setTotal(res.total); setPage(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, search, role, showDeleted])

  useEffect(() => { load() }, [load])

  const handleSearch = (val: string) => {
    setSearch(val)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => load(1, val, role, showDeleted), 350)
  }

  const handleRole = (val: string) => {
    setRole(val)
    load(1, search, val, showDeleted)
  }

  const handleToggleDeleted = () => {
    const next = !showDeleted
    setShowDeleted(next)
    load(1, search, role, next)
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">{total} utilisateur{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Rechercher par email…"
          className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
        <select
          value={role}
          onChange={e => handleRole(e.target.value)}
          className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tous les rôles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={handleToggleDeleted}
          className={`h-9 px-4 text-sm rounded-lg border transition-colors ${showDeleted ? 'bg-red-500/20 border-red-500/30 text-red-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
        >
          {showDeleted ? 'Bannis uniquement' : 'Voir bannis'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-gray-800 border border-gray-700 rounded-xl">
          <p className="text-gray-400 text-sm">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Profils</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">2FA</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email vérifié</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-700/30 transition-colors ${u.deletedAt ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-gray-200 font-medium">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-gray-700 text-gray-400'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{u._count.childProfiles}</td>
                  <td className="px-4 py-3">
                    {u.twoFactorEnabled
                      ? <span className="text-xs text-green-400">✓ Activé</span>
                      : <span className="text-xs text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.emailVerified
                      ? <span className="text-xs text-green-400">✓</span>
                      : <span className="text-xs text-amber-400">En attente</span>}
                  </td>
                  <td className="px-4 py-3">
                    {u.deletedAt
                      ? <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Banni</span>
                      : <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Actif</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/users/${u.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">← Précédent</button>
          <span className="text-sm text-gray-500">Page {page} / {pages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= pages} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Suivant →</button>
        </div>
      )}
    </div>
  )
}
