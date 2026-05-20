'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api } from '../../../../../lib/api'

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
    visibility: 'PRIVATE',
    targetAgeGroup: [] as string[],
    languages: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

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
      const pl = await api.playlists.create(token, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        targetAgeGroup: form.targetAgeGroup,
        languages: form.languages ? form.languages.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
      router.push(`/${locale}/dashboard/playlists/${pl.id}/edit`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle playlist</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la playlist</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            maxLength={100}
            placeholder="Ex : Mes vidéos nature"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            maxLength={500}
            rows={3}
            placeholder="Décrivez le contenu de cette playlist…"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visibilité</label>
          <div className="space-y-2">
            {VISIBILITY_OPTIONS.map(v => (
              <label key={v.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                form.visibility === v.value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="visibility"
                  value={v.value}
                  checked={form.visibility === v.value}
                  onChange={() => setForm(f => ({ ...f, visibility: v.value }))}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.label}</p>
                  <p className="text-xs text-gray-400">{v.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tranches d'âge cibles</label>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleAge(g.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  form.targetAgeGroup.includes(g.value)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {g.label} ans
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Langues</label>
          <input
            type="text"
            value={form.languages}
            onChange={e => setForm(f => ({ ...f, languages: e.target.value }))}
            placeholder="fr, en, ar"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Codes ISO séparés par des virgules</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Création...' : 'Créer et ajouter des vidéos →'}
        </button>
      </form>
    </div>
  )
}
