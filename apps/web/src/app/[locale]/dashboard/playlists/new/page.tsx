'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api } from '../../../../../lib/api'
import {
  PLAYLIST_CATEGORIES,
  LANGUAGE_OPTIONS,
  packPlaylistDescription,
} from '../../../../../lib/playlistCategory'

const AGE_GROUPS = [
  { value: 'AGE_0_3', label: '0–3' },
  { value: 'AGE_4_6', label: '4–6' },
  { value: 'AGE_7_9', label: '7–9' },
  { value: 'AGE_10_12', label: '10–12' },
  { value: 'AGE_13_15', label: '13–15' },
]

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Privée', desc: 'Visible uniquement par vous' },
  { value: 'SHARED_USERS', label: 'Partagée', desc: 'Partagée avec des utilisateurs spécifiques' },
  { value: 'SHARED_LINK', label: 'Lien public', desc: 'Accessible via un lien' },
]

export default function NewPlaylistPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'stories',
    visibility: 'PRIVATE',
    targetAgeGroup: [] as string[],
    language: 'fr',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [externalPlaylistUrl, setExternalPlaylistUrl] = useState('')
  const [importExternalPlaylist, setImportExternalPlaylist] = useState(false)

  const toggleAge = (val: string) => {
    setForm(f => ({
      ...f,
      targetAgeGroup: f.targetAgeGroup.includes(val)
        ? f.targetAgeGroup.filter(v => v !== val)
        : [...f.targetAgeGroup, val],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      const packedDesc = packPlaylistDescription(form.category, form.description)
      const pl = await api.playlists.create(token, {
        name: form.name.trim(),
        description: packedDesc || undefined,
        visibility: form.visibility,
        targetAgeGroup: form.targetAgeGroup,
        languages: form.language ? [form.language] : ['fr'],
        ...(importExternalPlaylist && {
          importExternalPlaylist: true,
          externalPlaylistUrl: externalPlaylistUrl.trim(),
        }),
      })
      const importResult = pl.importedVideoCount === undefined
        ? ''
        : `?imported=${pl.importedVideoCount}&pending=${pl.pendingValidationCount ?? 0}&skipped=${pl.skippedVideoCount ?? 0}&queueFailed=${pl.validationQueueFailedCount ?? 0}`
      router.push(`/${locale}/dashboard/playlists/${pl.id}/edit${importResult}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle playlist</h1>
          <p className="text-sm text-gray-500">Organisez vos vidéos familiales par univers thématique et tranche d&apos;âge.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* 1. Nom */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">Nom de la playlist *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            maxLength={100}
            placeholder="Ex : Histoires du soir & Prophètes, Safari des animaux..."
            className="w-full h-11 px-3.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* 2. Catégorie thématique (Dès l'ajout) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-800">
              Catégorie thématique *
            </label>
            <span className="text-xs text-indigo-600 font-medium">Définit le style et le classement</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {PLAYLIST_CATEGORIES.map(cat => {
              const selected = form.category === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl shrink-0 mt-0.5">{cat.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${selected ? 'text-indigo-900' : 'text-gray-900'}`}>
                      {cat.label}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{cat.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 3. Langue principale (Champ SELECT) */}
        <div>
          <label htmlFor="playlist-language-select" className="block text-sm font-semibold text-gray-800 mb-1.5">
            Langue de la playlist *
          </label>
          <div className="relative">
            <select
              id="playlist-language-select"
              value={form.language}
              onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
              className="w-full h-11 px-3.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all appearance-none cursor-pointer pr-10"
            >
              {LANGUAGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.flag} {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Sélectionnez la langue principale pour filtrer et recommander les contenus adaptés.</p>
        </div>

        {/* 4. Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            maxLength={500}
            rows={3}
            placeholder="Présentez le contenu et les thèmes abordés dans cette playlist…"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        {/* 5. Tranches d'âge cibles */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Tranches d&apos;âge cibles</label>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleAge(g.value)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  form.targetAgeGroup.includes(g.value)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                {g.label} ans
              </button>
            ))}
          </div>
        </div>

        {/* 6. Visibilité */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Visibilité</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {VISIBILITY_OPTIONS.map(v => (
              <label
                key={v.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.visibility === v.value
                    ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={v.value}
                  checked={form.visibility === v.value}
                  onChange={() => setForm(f => ({ ...f, visibility: v.value }))}
                  className="mt-0.5 accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{v.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 7. Import optionnel depuis URL externe */}
        <div className="space-y-2 border-t border-gray-100 pt-5">
          <label htmlFor="external-playlist-url" className="block text-sm font-semibold text-gray-800">
            URL d’une playlist, chaîne ou vidéo (YouTube, Vimeo, Dailymotion...) <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            id="external-playlist-url"
            type="url"
            value={externalPlaylistUrl}
            onChange={e => {
              setExternalPlaylistUrl(e.target.value)
              if (!e.target.value.trim()) setImportExternalPlaylist(false)
            }}
            placeholder="https://www.youtube.com/@chaine ou lien de playlist/vidéo"
            className="w-full h-11 px-3.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {externalPlaylistUrl.trim() && (
            <label className="flex items-start gap-2.5 text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 mt-2">
              <input
                type="checkbox"
                checked={importExternalPlaylist}
                onChange={e => setImportExternalPlaylist(e.target.checked)}
                className="mt-0.5 accent-indigo-600"
              />
              <span>
                Importer les vidéos de cette playlist, chaîne ou vidéo
                <span className="block text-xs text-gray-500 mt-0.5">
                  Chaque vidéo importée sera analysée et envoyée automatiquement en validation prioritaire.
                </span>
              </span>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 shadow-sm text-sm"
        >
          {saving
            ? importExternalPlaylist ? 'Importation des vidéos...' : 'Création en cours...'
            : 'Créer et organiser les vidéos →'}
        </button>
      </form>
    </div>
  )
}
