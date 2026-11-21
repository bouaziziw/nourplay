'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { api, ApiError } from '../../../../lib/api'

export default function VerifyEmailPage() {
  const locale = useLocale()
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token manquant'); return }
    api.auth.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => { setStatus('error'); setMessage(err instanceof ApiError ? err.message : 'Erreur de vérification') })
  }, [token])

  if (status === 'loading') {
    return <div className="text-center text-gray-500 py-8">Vérification en cours…</div>
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Email vérifié !</h2>
        <p className="text-gray-500 text-sm mb-6">Votre adresse email a été confirmée avec succès.</p>
        <Link href={`/${locale}/auth/login`} className="inline-flex items-center justify-center h-11 px-6 bg-primary text-white rounded-xl font-medium text-sm hover:opacity-95 transition-opacity">
          Se connecter
        </Link>
      </div>
    )
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setResending(true)
    try {
      await api.auth.resendVerification({ email: email.trim() })
      setResendStatus('success')
    } catch {
      setResendStatus('error')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="text-center max-w-sm mx-auto">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Lien invalide ou expiré</h2>
      <p className="text-gray-500 text-sm mb-6">{message || 'Ce lien de vérification est invalide ou a expiré.'}</p>

      {resendStatus === 'success' ? (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-4 rounded-xl mb-6">
          Si un compte non vérifié correspond à cette adresse, un nouvel email vous a été envoyé.
        </div>
      ) : (
        <form onSubmit={handleResend} className="mb-6 text-left">
          <label htmlFor="resend-email" className="block text-xs font-medium text-gray-700 mb-1">
            Renvoyer un nouveau lien de vérification
          </label>
          <div className="flex gap-2">
            <input
              id="resend-email"
              type="email"
              required
              placeholder="votre@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 h-10 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={resending || !email.trim()}
              className="h-10 px-4 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              {resending ? 'Envoi…' : 'Renvoyer'}
            </button>
          </div>
          {resendStatus === 'error' && (
            <p className="text-xs text-red-600 mt-1">Une erreur est survenue lors de l&apos;envoi.</p>
          )}
        </form>
      )}

      <div>
        <Link href={`/${locale}/auth/login`} className="text-primary text-sm font-medium hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
