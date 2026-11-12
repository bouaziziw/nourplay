'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { ApiError } from '../../../../lib/api'

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof TypeError) {
    return "Impossible de joindre le serveur de connexion. Vérifiez que l'API est démarrée, puis réessayez."
  }
  return fallback
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTotp, setShowTotp] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requiresTwoFactor && result.userId) {
        setUserId(result.userId)
        setShowTotp(true)
      } else {
        router.push(`/${locale}/child`)
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Erreur de connexion'))
    } finally {
      setLoading(false)
    }
  }

  if (showTotp) {
    return <TotpStep userId={userId!} locale={locale} onSuccess={async () => { router.push(`/${locale}/child`) }} />
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('login')}</h2>

      {error && (
        <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
          <input
            id="email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">{t('password')}</label>
            <Link href={`/${locale}/auth/forgot-password`} className="text-xs text-indigo-600 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            id="password" type="password" autoComplete="current-password" required
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit" disabled={loading}
        className="mt-6 w-full h-11 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Connexion…' : t('login')}
      </button>

      <p className="mt-3 text-center text-sm">
        <Link href={`/${locale}/auth/magic-link`} className="text-indigo-600 hover:underline">
          Connexion sans mot de passe (lien email)
        </Link>
      </p>

      <p className="mt-2 text-center text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link href={`/${locale}/auth/register`} className="text-indigo-600 font-medium hover:underline">
          {t('register')}
        </Link>
      </p>
    </form>
  )
}

function TotpStep({ userId, locale, onSuccess }: { userId: string; locale: string; onSuccess: (token: string) => Promise<void> }) {
  const { setToken } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { api } = await import('../../../../lib/api')
      const result = await api.auth.loginWith2fa({ userId, code })
      if (result.accessToken) {
        await setToken(result.accessToken)
        await onSuccess(result.accessToken)
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Code incorrect'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Vérification en 2 étapes</h2>
      <p className="text-sm text-gray-500 mb-6">Entrez le code à 6 chiffres depuis votre application d&apos;authentification.</p>

      {error && <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      <input
        type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
        value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        className="w-full h-12 rounded-lg border border-gray-300 px-4 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        aria-label="Code TOTP"
      />

      <button type="submit" disabled={loading || code.length !== 6}
        className="mt-4 w-full h-11 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Vérification…' : 'Confirmer'}
      </button>
    </form>
  )
}
