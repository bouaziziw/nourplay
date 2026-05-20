'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  profileName: string
  onSubmit: (pin: string) => Promise<void>
  onClose: () => void
}

export function PinModal({ profileName, onSubmit, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4) return
    setError('')
    setLoading(true)
    try {
      await onSubmit(pin)
    } catch {
      setError('PIN incorrect')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-indigo-600">
          {profileName.slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-xl font-bold text-center text-gray-900 mb-1">{profileName}</h2>
        <p className="text-sm text-gray-500 text-center mb-6">Entrez le PIN pour accéder à ce profil</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center text-4xl tracking-[1.5rem] border-2 border-gray-200 rounded-xl py-4 px-2 focus:border-indigo-500 focus:outline-none transition-colors"
            placeholder="••••"
            autoComplete="off"
          />

          {error && (
            <p className="text-red-500 text-sm text-center animate-shake">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full h-12 bg-indigo-600 text-white rounded-xl font-semibold disabled:opacity-40 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Valider'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
