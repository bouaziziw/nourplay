'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '../../../../../hooks/useAuth'
import { api } from '../../../../../lib/api'

const AGE_RATINGS = [
  { value: 'ALL', label: 'Tous publics' },
  { value: 'AGE_4_PLUS', label: '4+' },
  { value: 'AGE_7_PLUS', label: '7+' },
  { value: 'AGE_10_PLUS', label: '10+' },
  { value: 'AGE_13_PLUS', label: '13+' },
]

export default function SubmitVideoPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [form, setForm] = useState({ url: '', ageRating: 'ALL', language: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string; title: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setError('')
    setSubmitting(true)
    try {
      const video = await api.videos.submit(token, {
        url: form.url.trim(),
        ageRating: form.ageRating,
        language: form.language.trim() || undefined,
      })
      setSubmitted({ id: video.id, title: video.title })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
        <h2 className="text-xl font-bold text-gray-900">Vidéo soumise</h2>
        <p className="text-gray-500 text-sm">
          <strong className="text-gray-900">{submitted.title}</strong> a été soumise et est en attente de validation.
          Elle sera disponible dans les recherches une fois approuvée.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => { setSubmitted(null); setForm({ url: '', ageRating: 'ALL', language: '' }) }}
            className="h-9 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 transition-colors"
          >
            Soumettre une autre
          </button>
          <Link
            href={`/${locale}/dashboard`}
            className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center"
          >
            Tableau de bord
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Soumettre une vidéo</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        Les vidéos soumises passent par une validation automatique puis manuelle avant d'être accessibles.
        Seules les URLs YouTube et Vimeo sont acceptées.
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de la vidéo</label>
          <input
            type="url"
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            required
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">YouTube ou Vimeo uniquement</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Classification d'âge</label>
          <div className="grid grid-cols-5 gap-2">
            {AGE_RATINGS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, ageRating: r.value }))}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.ageRating === r.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Langue <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input
            type="text"
            value={form.language}
            onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
            maxLength={10}
            placeholder="fr, en, ar…"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Soumission en cours...' : 'Soumettre pour validation'}
        </button>
      </form>
    </div>
  )
}
