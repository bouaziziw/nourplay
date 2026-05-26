'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { api, ApiError } from '../../../../lib/api'

export default function ForgotPasswordPage() {
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.auth.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Email envoyé</h2>
        <p className="text-sm text-gray-500">
          Si un compte existe pour <strong className="text-gray-700">{email}</strong>, vous recevrez un lien de réinitialisation sous quelques minutes.
          Vérifiez vos spams si nécessaire.
        </p>
        <Link href={`/${locale}/auth/login`} className="text-sm text-indigo-600 font-medium hover:underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Mot de passe oublié</h2>
      <p className="text-sm text-gray-500 mb-6">
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="mb-5">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="email" type="email" required autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)}
          className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full h-11 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Envoi en cours…' : 'Envoyer le lien'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link href={`/${locale}/auth/login`} className="text-indigo-600 font-medium hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  )
}
