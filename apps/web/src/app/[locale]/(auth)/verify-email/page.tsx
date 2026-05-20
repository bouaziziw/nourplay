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
        <Link href={`/${locale}/auth/login`} className="inline-flex items-center justify-center h-11 px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors">
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</h2>
      <p className="text-gray-500 text-sm mb-6">{message || 'Ce lien est invalide ou a expiré.'}</p>
      <Link href={`/${locale}/auth/login`} className="text-indigo-600 text-sm font-medium hover:underline">
        Retour à la connexion
      </Link>
    </div>
  )
}
