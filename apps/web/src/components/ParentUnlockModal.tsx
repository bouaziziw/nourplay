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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 id="parent-unlock-title" className="mb-2 text-center text-xl font-bold text-gray-900">
          Mode Parent
        </h2>
        <p className="mb-6 text-center text-sm text-gray-500">
          Entrez le mot de passe de votre compte pour accéder aux paramètres.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Mot de passe du compte"
            aria-label="Mot de passe du compte"
            className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {error && <p role="alert" className="text-center text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="h-11 w-full rounded-lg bg-indigo-600 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="mt-3 h-9 w-full text-sm text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
