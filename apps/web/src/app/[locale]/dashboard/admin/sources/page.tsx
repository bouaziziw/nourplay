'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, VideoSource } from '../../../../../lib/api'

const EMPTY_FORM = { name: '', slug: '', baseUrl: '', cguVersion: '', embedAllowed: false }

export default function AdminSourcesPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token, user } = useAuth()

  const [sources, setSources] = useState<VideoSource[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  // New source form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  // Inline CGU version edit
  const [editingCgu, setEditingCgu] = useState<string | null>(null)
  const [cguInput, setCguInput] = useState('')
  const [savingCgu, setSavingCgu] = useState(false)

  // Verify in-progress set
  const [verifying, setVerifying] = useState<Set<string>>(new Set())
  // Toggling set
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      router.replace(`/${locale}/dashboard`)
    }
  }, [user, locale, router])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await api.videos.listSources(token)
      setSources(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleToggle = async (source: VideoSource, field: 'embedAllowed' | 'isActive') => {
    if (!token) return
    const key = `${source.id}:${field}`
    setToggling(prev => new Set(prev).add(key))
    try {
      const updated = await api.videos.updateSource(token, source.id, { [field]: !source[field] })
      setSources(prev => prev.map(s => s.id === source.id ? updated : s))
      showToast(`${field === 'embedAllowed' ? 'Autorisation embed' : 'Source'} mise à jour.`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour.')
    } finally {
      setToggling(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }

  const handleVerify = async (id: string) => {
    if (!token) return
    setVerifying(prev => new Set(prev).add(id))
    try {
      const updated = await api.videos.verifySource(token, id)
      setSources(prev => prev.map(s => s.id === id ? updated : s))
      showToast('Vérification CGU enregistrée.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur de vérification.')
    } finally {
      setVerifying(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const handleSaveCgu = async (id: string) => {
    if (!token) return
    setSavingCgu(true)
    try {
      const updated = await api.videos.updateSource(token, id, { cguVersion: cguInput.trim() || undefined })
      setSources(prev => prev.map(s => s.id === id ? updated : s))
      setEditingCgu(null)
      showToast('Version CGU mise à jour.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour.')
    } finally {
      setSavingCgu(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setFormError('')
    if (!form.name.trim() || !form.slug.trim() || !form.baseUrl.trim()) {
      setFormError('Nom, slug et URL de base sont obligatoires.')
      return
    }
    setCreating(true)
    try {
      const created = await api.videos.createSource(token, {
        name: form.name.trim(),
        slug: form.slug.trim(),
        baseUrl: form.baseUrl.trim(),
        embedAllowed: form.embedAllowed,
        cguVersion: form.cguVersion.trim() || undefined,
      })
      setSources(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(EMPTY_FORM)
      setShowForm(false)
      showToast(`Source « ${created.name} » créée.`)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erreur de création.')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  if (!user) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sources vidéo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gérez les plateformes autorisées à intégrer du contenu dans NourPlay.
          </p>
        </div>
        {user.role === 'ADMIN' && (
          <button
            onClick={() => { setShowForm(v => !v); setFormError('') }}
            className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showForm ? 'Annuler' : '+ Ajouter une source'}
          </button>
        )}
      </div>

      {/* New source form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-gray-800">Nouvelle source</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="YouTube"
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                placeholder="youtube"
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">URL de base</label>
              <input
                value={form.baseUrl}
                onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://www.youtube.com"
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Version CGU</label>
              <input
                value={form.cguVersion}
                onChange={e => setForm(f => ({ ...f, cguVersion: e.target.value }))}
                placeholder="2024-01-01"
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.embedAllowed}
                  onChange={e => setForm(f => ({ ...f, embedAllowed: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Embed autorisé</span>
              </label>
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="h-9 px-5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Création…' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError('') }}
              className="h-9 px-4 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Aucune source configurée.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">URL de base</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Embed</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Active</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">CGU</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">Dernière vérif.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">Vidéos</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sources.map(source => (
                  <tr key={source.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{source.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{source.slug}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs font-mono truncate max-w-48">
                      {source.baseUrl}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'ADMIN' ? (
                        <button
                          onClick={() => handleToggle(source, 'embedAllowed')}
                          disabled={toggling.has(`${source.id}:embedAllowed`)}
                          title={source.embedAllowed ? 'Désactiver l\'embed' : 'Autoriser l\'embed'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                            source.embedAllowed ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            source.embedAllowed ? 'translate-x-4' : 'translate-x-1'
                          }`} />
                        </button>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          source.embedAllowed
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {source.embedAllowed ? 'Oui' : 'Non'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'ADMIN' ? (
                        <button
                          onClick={() => handleToggle(source, 'isActive')}
                          disabled={toggling.has(`${source.id}:isActive`)}
                          title={source.isActive ? 'Désactiver la source' : 'Activer la source'}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                            source.isActive ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            source.isActive ? 'translate-x-4' : 'translate-x-1'
                          }`} />
                        </button>
                      ) : (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          source.isActive
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                          {source.isActive ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {editingCgu === source.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={cguInput}
                            onChange={e => setCguInput(e.target.value)}
                            placeholder="2024-01-01"
                            className="w-28 h-7 px-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveCgu(source.id); if (e.key === 'Escape') setEditingCgu(null) }}
                          />
                          <button
                            onClick={() => handleSaveCgu(source.id)}
                            disabled={savingCgu}
                            className="h-7 px-2 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                          >
                            OK
                          </button>
                          <button onClick={() => setEditingCgu(null)} className="h-7 px-1.5 text-gray-400 hover:text-gray-600 text-xs">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCgu(source.id); setCguInput(source.cguVersion ?? '') }}
                          className="text-xs text-gray-600 hover:text-indigo-600 transition-colors group flex items-center gap-1"
                          title="Modifier la version CGU"
                        >
                          {source.cguVersion ?? <span className="text-gray-300">—</span>}
                          {user.role === 'ADMIN' && (
                            <svg className="w-3 h-3 text-gray-300 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                      {formatDate(source.cguCheckedAt)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {source._count.videos}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleVerify(source.id)}
                        disabled={verifying.has(source.id)}
                        className="h-7 px-3 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
                        title="Marquer les CGU comme vérifiées aujourd'hui"
                      >
                        {verifying.has(source.id) ? '…' : 'Vérifier CGU'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <p className="text-xs text-gray-400">
        Les sources avec <strong>Embed = Oui</strong> peuvent être soumises via le formulaire de vidéo.
        La vérification CGU enregistre la date à laquelle un administrateur a contrôlé manuellement les conditions d&apos;utilisation de la plateforme.
      </p>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
