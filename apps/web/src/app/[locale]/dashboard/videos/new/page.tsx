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
  const { token, loading: authLoading } = useAuth()

  const [form, setForm] = useState({ url: '', ageRating: 'ALL', language: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{
    id: string
    title: string
    validationStatus: string
    submitterApprovedAt: string | null
  } | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [approvalError, setApprovalError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError('Votre session a expiré. Veuillez vous reconnecter avant de soumettre une vidéo.')
      return
    }
    setError('')
    setSubmitting(true)
    setApproved(false)
    setApprovalError('')
    try {
      const video = await api.videos.submit(token, {
        url: form.url.trim(),
        ageRating: form.ageRating,
        language: form.language.trim() || undefined,
      })
      const submitterApprovedAt = video.submitterApprovedAt ?? null
      setSubmitted({ id: video.id, title: video.title, validationStatus: video.validationStatus, submitterApprovedAt })
      setApproved(video.validationStatus !== 'PENDING' || Boolean(submitterApprovedAt))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (!token || !submitted) return
    setApproving(true)
    setApprovalError('')
    try {
      await api.videos.approveSubmission(token, submitted.id)
      setApproved(true)
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : 'Impossible de valider cette vidéo.')
    } finally {
      setApproving(false)
    }
  }

  if (submitted) {
    return (
      <div className="w-full text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
        <h2 className="text-xl font-bold text-gray-900">Vidéo soumise</h2>
        <p className="text-gray-500 text-sm">
          <strong className="text-gray-900">{submitted.title}</strong>{' '}
          {submitted.validationStatus === 'APPROVED'
            ? 'est déjà approuvée et disponible.'
            : submitted.validationStatus === 'REJECTED'
              ? 'a été refusée par le système.'
              : submitted.validationStatus === 'NEEDS_REVIEW'
                ? 'attend la vérification d’un modérateur.'
                : approved
                  ? 'a été approuvée par vous. Le contrôle automatique est en cours ; elle sera disponible après validation du système.'
                  : 'a été ajoutée. Approuvez-la pour lancer le contrôle automatique avant sa publication.'}
        </p>
        {approvalError && <p role="alert" className="text-sm text-red-600">{approvalError}</p>}
        <div className="flex items-center justify-center gap-3 pt-2">
          {!approved && submitted.validationStatus === 'PENDING' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="h-9 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {approving ? 'Validation…' : 'Valider et lancer le contrôle'}
            </button>
          )}
          <button
            onClick={() => {
              setSubmitted(null)
              setApproved(false)
              setApprovalError('')
              setForm({ url: '', ageRating: 'ALL', language: '' })
            }}
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
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Soumettre une vidéo</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        Les vidéos soumises passent par une validation automatique puis manuelle avant d&apos;être accessibles.
        Seules les URLs YouTube et Vimeo sont acceptées.
      </div>

      {authLoading ? (
        <p role="status" className="text-sm text-gray-500">Vérification de votre session...</p>
      ) : !token ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Votre session a expiré.{' '}
          <Link href={`/${locale}/auth/login`} className="font-semibold underline hover:text-amber-900">
            Connectez-vous à nouveau
          </Link>{' '}
          pour soumettre une vidéo.
        </div>
      ) : null}

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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Classification d&apos;âge</label>
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
          disabled={submitting || authLoading || !token}
          className="w-full h-11 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {submitting
            ? 'Soumission en cours...'
            : authLoading
              ? 'Vérification de la session...'
              : 'Soumettre pour validation'}
        </button>
      </form>
    </div>
  )
}
