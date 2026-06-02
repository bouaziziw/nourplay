'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { api, ApiError } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'

export default function MagicLinkVerifyPage() {
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')
  const { setToken } = useAuth()

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState<string | null>(null)

  const verify = useCallback(async () => {
    if (!token) {
      setError('Token manquant dans l\'URL.')
      setStatus('error')
      return
    }
    try {
      const result = await api.auth.verifyMagicLink(token)
      setToken(result.accessToken)
      setStatus('success')
      setTimeout(() => router.push(`/${locale}/dashboard`), 1500)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Lien invalide ou expiré.')
      setStatus('error')
    }
  }, [token, locale, router, setToken])

  useEffect(() => { verify() }, [verify])

  if (status === 'verifying') {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 text-sm">Vérification de votre lien…</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connexion réussie !</h2>
        <p className="text-sm text-gray-500">Redirection vers votre espace…</p>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</h2>
      <p className="text-sm text-gray-500 mb-6">{error}</p>
      <Link
        href={`/${locale}/auth/magic-link`}
        className="inline-block px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Demander un nouveau lien
      </Link>
    </div>
  )
}
