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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (pin.length < 4 || loading) return
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

  const handleDigit = (d: string) => {
    if (pin.length < 6) {
      const next = pin + d
      setPin(next)
      if (next.length >= 4) {
        // Auto-submit when reaching 4 digits for fast TV remote operation
        setError('')
      }
    }
  }

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1))
    setError('')
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md shadow-2xl border border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-black text-white shadow-md">
          {profileName.slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-center text-gray-900 mb-1">{profileName}</h2>
        <p className="text-xs sm:text-sm font-medium text-gray-500 text-center mb-5">
          {"Entrez votre code secret à 4 chiffres"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            className="w-full text-center text-3xl sm:text-4xl tracking-[1.2rem] sm:tracking-[1.5rem] border-2 border-gray-200 rounded-2xl py-3 px-2 focus:border-[#1c90d8] focus:outline-none transition-all shadow-inner bg-gray-50/50"
            placeholder="••••"
            autoComplete="off"
          />

          {error && (
            <p className="text-red-600 text-xs sm:text-sm text-center font-bold animate-shake">{error}</p>
          )}

          {/* On-Screen TV Remote Numeric Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="h-12 rounded-2xl bg-gray-50 hover:bg-sky-50 hover:text-[#1c90d8] text-gray-800 text-lg font-extrabold transition-all border border-gray-200 active:scale-95 shadow-2xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBackspace}
              title="Effacer un chiffre"
              className="h-12 rounded-2xl bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-700 text-sm font-extrabold transition-all border border-gray-200 active:scale-95 flex items-center justify-center"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-12 rounded-2xl bg-gray-50 hover:bg-sky-50 hover:text-[#1c90d8] text-gray-800 text-lg font-extrabold transition-all border border-gray-200 active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={pin.length < 4 || loading}
              className="h-12 rounded-2xl bg-[#1c90d8] hover:bg-[#1572ab] text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 active:scale-95 shadow-md flex items-center justify-center"
            >
              OK ▶
            </button>
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full h-12 bg-[#1c90d8] text-white rounded-2xl font-black text-sm disabled:opacity-40 hover:bg-[#1572ab] active:scale-95 transition-all shadow-md mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Valider le PIN</span>
            )}
          </button>
        </form>

        <button
          onClick={onClose}
          type="button"
          className="mt-3 w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
