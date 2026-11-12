'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { api, ApiError } from '../../../../lib/api'

export default function MagicLinkPage() {
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (cooldown > 0) return
    setError(null)
    setLoading(true)
    try {
      await api.auth.requestMagicLink(email)
      setSent(true)
      // Cooldown 60s avant de pouvoir renvoyer
      let t = 60
      setCooldown(t)
      const interval = setInterval(() => {
        t -= 1
        setCooldown(t)
        if (t <= 0) clearInterval(interval)
      }, 1000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div>
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Vérifiez votre boîte mail</h2>
        <p className="text-sm text-gray-500 mb-6">
          Un lien de connexion valable <strong>15 minutes</strong> a été envoyé à <strong>{email}</strong>.
        </p>
        <p className="text-xs text-gray-400">
          Pas reçu ?{' '}
          {cooldown > 0 ? (
            <span className="text-gray-400">Renvoyer dans {cooldown}s</span>
          ) : (
            <button
              onClick={() => { setSent(false) }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Renvoyer le lien
            </button>
          )}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Connexion sans mot de passe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Entrez votre email et nous vous enverrons un lien pour vous connecter instantanément.
      </p>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Adresse email
          </label>
          <input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit" disabled={loading || !email}
        className="mt-6 w-full h-11 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Envoi en cours…' : 'Envoyer le lien de connexion'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Vous préférez le mot de passe ?{' '}
        <Link href={`/${locale}/auth/login`} className="text-indigo-600 font-medium hover:underline">
          Connexion classique
        </Link>
      </p>
    </form>
  )
}
