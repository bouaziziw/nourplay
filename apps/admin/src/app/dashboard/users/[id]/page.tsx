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
  PARENT: 'bg-primary/20 text-sky-400',
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

  const [emailInput, setEmailInput] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    if (!token) return
    api.admin.getUserById(token, id)
      .then(u => {
        setUser(u)
        setSelectedRole(u.role)
        setEmailInput(u.email)
      })
      .catch(() => router.replace('/dashboard/users'))
      .finally(() => setLoading(false))
  }, [token, id, router])

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !user || !emailInput || emailInput === user.email) return
    setSavingEmail(true)
    setError('')
    try {
      const updated = await api.admin.updateUser(token, id, { email: emailInput.trim().toLowerCase() })
      setUser(updated)
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la modification de l’email.')
    } finally {
      setSavingEmail(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !user || !newPassword) return
    if (newPassword.length < 8) {
      setError('Le mot de passe doit comporter au moins 8 caractères.')
      return
    }
    setSavingPassword(true)
    setError('')
    try {
      await api.admin.updateUser(token, id, { password: newPassword })
      setPasswordSaved(true)
      setNewPassword('')
      setTimeout(() => setPasswordSaved(false), 2500)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la réinitialisation du mot de passe.')
    } finally {
      setSavingPassword(false)
    }
  }

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
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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

      {/* Edit email & password */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-5">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Modifier les informations & mot de passe</h2>

        {/* Change email */}
        <form onSubmit={handleEmailChange} className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">Adresse email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              required
              className="flex-1 h-9 px-3 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={savingEmail || !emailInput || emailInput === user.email}
              className="h-9 px-4 bg-primary hover:bg-primary-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {savingEmail ? 'Enregistrement…' : emailSaved ? '✓ Email modifié' : 'Modifier l’email'}
            </button>
          </div>
        </form>

        <div className="border-t border-gray-700/60 pt-4">
          {/* Change password */}
          <form onSubmit={handlePasswordReset} className="space-y-2">
            <label className="block text-xs font-medium text-gray-400">Réinitialiser le mot de passe</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe (min 8 caractères)"
                minLength={8}
                className="flex-1 h-9 px-3 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={savingPassword || !newPassword || newPassword.length < 8}
                className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
              >
                {savingPassword ? 'Modification…' : passwordSaved ? '✓ Mot de passe réinitialisé' : 'Réinitialiser le mot de passe'}
              </button>
            </div>
          </form>
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
              className="h-9 px-3 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={handleRoleChange}
              disabled={saving || selectedRole === user.role}
              className="h-9 px-4 bg-primary hover:bg-primary-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
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
