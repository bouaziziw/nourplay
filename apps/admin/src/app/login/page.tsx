'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@nourplay/ui'
import { useAuth } from '../../hooks/useAuth'
import { ApiError } from '../../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { login, loginWith2fa } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials')
  const [pendingUserId, setPendingUserId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.requiresTwoFactor && result.userId) {
        setPendingUserId(result.userId)
        setStep('2fa')
      } else {
        router.replace('/dashboard')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWith2fa(pendingUserId, code)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Code incorrect.')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size="lg" subtitle="Admin" theme="light" className="justify-center mb-2" />
          <p className="text-slate-600 text-sm">Back-office d&apos;administration sécurisé</p>
        </div>

        <div className="bg-white/85 rounded-2xl p-6 border border-slate-200 shadow-xl backdrop-blur-md">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent"
                  placeholder="admin@exemple.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#1c90d8] hover:bg-[#1572ab] text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 shadow-md"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          ) : (
            <form onSubmit={handle2fa} className="space-y-4">
              <p className="text-sm text-slate-700 text-center">
                Code à 6 chiffres de votre application d&apos;authentification
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
                className="w-full h-12 px-3 bg-white border border-slate-300 rounded-xl text-xl text-slate-900 text-center tracking-[0.5em] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent"
                placeholder="000000"
              />
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full h-10 bg-[#1c90d8] hover:bg-[#1572ab] text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 shadow-md"
              >
                {loading ? 'Vérification…' : 'Valider'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
