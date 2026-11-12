'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../hooks/useAuth'
import { api, AdminUser } from '../../../../lib/api'

const ROLES = ['ADMIN', 'MODERATOR', 'TEACHER', 'PARENT']

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/20 text-red-400',
  MODERATOR: 'bg-amber-500/20 text-amber-400',
  TEACHER: 'bg-sky-500/20 text-sky-400',
  PARENT: 'bg-indigo-500/20 text-indigo-400',
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user: me, token } = useAuth()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banning, setBanning] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [roleSaved, setRoleSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    api.admin.getUserById(token, id)
      .then(u => { setUser(u); setSelectedRole(u.role) })
      .catch(() => router.replace('/dashboard/users'))
      .finally(() => setLoading(false))
  }, [token, id, router])

  const handleRoleChange = async () => {
    if (!token || !user || selectedRole === user.role) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.admin.updateUser(token, id, { role: selectedRole })
      setUser(updated)
      setRoleSaved(true)
      setTimeout(() => setRoleSaved(false), 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.')
    } finally {
      setSaving(false)
    }
  }

  const handleBanToggle = async () => {
    if (!token || !user) return
    const isBanned = !!user.deletedAt
    setBanning(true)
    setError('')
    try {
      const updated = await api.admin.updateUser(token, id, { banned: isBanned ? false : true })
      setUser(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la mise à jour.')
    } finally {
      setBanning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) return null

  const isBanned = !!user.deletedAt
  const isSelf = me?.id === user.id

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">Utilisateur</h1>
        {isBanned
          ? <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-medium">Banni</span>
          : <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-medium">Actif</span>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Profile info */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Informations</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Email</p>
            <p className="text-gray-200">{user.email}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Langue</p>
            <p className="text-gray-200 uppercase">{user.locale}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Email vérifié</p>
            <p className={user.emailVerified ? 'text-green-400' : 'text-amber-400'}>
              {user.emailVerified ? 'Oui' : 'En attente'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Authentification 2FA</p>
            <p className={user.twoFactorEnabled ? 'text-green-400' : 'text-gray-500'}>
              {user.twoFactorEnabled ? 'Activée' : 'Désactivée'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Profils enfants</p>
            <p className="text-gray-200">{user._count.childProfiles}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Playlists</p>
            <p className="text-gray-200">{user._count.playlists}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Membre depuis</p>
            <p className="text-gray-200">
              {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          {user.deletedAt && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Banni le</p>
              <p className="text-red-400">
                {new Date(user.deletedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Role management */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role] ?? 'bg-gray-700 text-gray-400'}`}>
            {user.role}
          </span>
          {isSelf && (
            <span className="text-xs text-gray-500">(c&apos;est vous — rôle non modifiable)</span>
          )}
        </div>
        {!isSelf && (
          <div className="flex items-center gap-3">
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="h-9 px-3 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={handleRoleChange}
              disabled={saving || selectedRole === user.role}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Mise à jour…' : roleSaved ? '✓ Sauvegardé' : 'Changer le rôle'}
            </button>
          </div>
        )}
      </div>

      {/* Ban / restore */}
      {!isSelf && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {isBanned ? 'Restaurer le compte' : 'Bannir le compte'}
          </h2>
          <p className="text-xs text-gray-500">
            {isBanned
              ? 'Restaurer l\'accès de cet utilisateur à la plateforme.'
              : 'Bannir cet utilisateur désactivera l\'accès à la plateforme. Les données sont conservées.'}
          </p>
          <button
            onClick={handleBanToggle}
            disabled={banning}
            className={`h-9 px-5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors ${
              isBanned
                ? 'bg-green-600 hover:bg-green-500'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {banning ? 'En cours…' : isBanned ? 'Restaurer l\'accès' : 'Bannir l\'utilisateur'}
          </button>
        </div>
      )}
    </div>
  )
}
