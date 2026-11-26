'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit: (password: string) => Promise<void>
  onClose: () => void
}

export function ParentUnlockModal({ onSubmit, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loading, onClose])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await onSubmit(password)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Mot de passe incorrect')
      setPassword('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => { if (!loading) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-unlock-title"
        className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-[#1c90d8]">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 id="parent-unlock-title" className="mb-2 text-center text-xl font-bold text-gray-900">
          Mode Parent
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Entrez le mot de passe de votre compte ou votre code PIN pour accéder à l’espace parent.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mot de passe ou code PIN"
            aria-label="Mot de passe ou code PIN"
            className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm focus:border-[#1c90d8] focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
          {error && <p role="alert" className="text-center text-sm text-red-600 font-medium">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="h-11 w-full rounded-xl bg-[#1c90d8] font-medium text-white transition-colors hover:bg-[#1572ab] disabled:cursor-wait disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-2 text-center">
          <a
            href="/fr/auth/login"
            className="text-xs text-[#1c90d8] hover:underline font-semibold"
          >
            Se reconnecter avec ses identifiants
          </a>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="h-8 w-full text-xs font-medium text-gray-400 transition-colors hover:text-gray-700 disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}
