'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { api, ApiError } from '../../../../lib/api'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'PARENT' | 'TEACHER'>('PARENT')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const passwordStrength = (() => {
    if (password.length < 8) return 0
    let score = 0
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[@$!%*?&]/.test(password)) score++
    return score
  })()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.auth.register({ email, password, role, locale })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Compte créé !</h2>
        <p className="text-gray-500 text-sm">Un email de vérification a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception.</p>
        <Link href={`/${locale}/auth/login`} className="mt-6 inline-block text-indigo-600 text-sm font-medium hover:underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  const strengthColors = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-yellow-400', 'bg-green-500']
  const strengthLabels = ['', 'Faible', 'Moyen', 'Bien', 'Fort']

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('register')}</h2>

      {error && <div role="alert" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Je suis</label>
          <div className="grid grid-cols-2 gap-2">
            {(['PARENT', 'TEACHER'] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`h-10 rounded-lg border text-sm font-medium transition-colors ${role === r ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {r === 'PARENT' ? 'Un parent' : 'Un enseignant'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
          <input id="email" type="email" autoComplete="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{t('password')}</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={12}
            value={password} onChange={e => setPassword(e.target.value)}
            className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">{strengthLabels[passwordStrength]} — min. 12 caractères, 1 majuscule, 1 chiffre, 1 spécial</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        En créant un compte, vous acceptez nos{' '}
        <Link href={`/${locale}/legal/cgu`} className="underline">CGU</Link> et notre{' '}
        <Link href={`/${locale}/legal/privacy`} className="underline">politique de confidentialité</Link>.
      </p>

      <button type="submit" disabled={loading}
        className="mt-4 w-full h-11 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Création…' : t('register')}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Déjà un compte ?{' '}
        <Link href={`/${locale}/auth/login`} className="text-indigo-600 font-medium hover:underline">{t('login')}</Link>
      </p>
    </form>
  )
}
