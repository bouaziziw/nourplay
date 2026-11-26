'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api } from '../../../../../lib/api'

const AGE_GROUPS = [
  { value: 'AGE_0_3', label: '0–3 ans' },
  { value: 'AGE_4_6', label: '4–6 ans' },
  { value: 'AGE_7_9', label: '7–9 ans' },
  { value: 'AGE_10_12', label: '10–12 ans' },
  { value: 'AGE_13_15', label: '13–15 ans' },
]

export default function NewProfilePage() {
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [form, setForm] = useState({
    displayName: '',
    ageGroup: 'AGE_4_6',
    pin: '',
    pinConfirm: '',
    dailyLimitMin: '',
    sessionLimitMin: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState(false)

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!/^\d{4,6}$/.test(form.pin)) {
      setError('Le PIN doit contenir entre 4 et 6 chiffres.')
      return
    }
    if (form.pin !== form.pinConfirm) {
      setError('Les deux PIN ne correspondent pas.')
      return
    }
    if (!token) return

    setSaving(true)
    try {
      await api.users.createProfile(token, {
        displayName: form.displayName.trim(),
        ageGroup: form.ageGroup,
        pin: form.pin,
        ...(timerEnabled && form.dailyLimitMin && { dailyLimitMin: Number(form.dailyLimitMin) }),
        ...(timerEnabled && form.sessionLimitMin && { sessionLimitMin: Number(form.sessionLimitMin) }),
      })
      router.push(`/${locale}/dashboard`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau profil</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-2">
            <p className="font-medium">{error}</p>
            {(error.includes('forfait') || error.includes('limité') || error.includes('Premium')) && (
              <div className="pt-1">
                <Link
                  href={`/${locale}/dashboard/subscription`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
                >
                  <span>⭐</span>
                  <span>Passer à Premium pour des profils illimités</span>
                </Link>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom / Nom affiché</label>
          <input
            type="text"
            value={form.displayName}
            onChange={e => set('displayName', e.target.value)}
            required
            maxLength={30}
            placeholder="Ex : Léa"
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Tranche d&apos;âge</label>
          <div className="grid grid-cols-5 gap-2">
            {AGE_GROUPS.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => set('ageGroup', g.value)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  form.ageGroup === g.value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Code PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.pin}
              onChange={e => set('pin', e.target.value)}
              required
              maxLength={6}
              placeholder="4–6 chiffres"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.pinConfirm}
              onChange={e => set('pinConfirm', e.target.value)}
              required
              maxLength={6}
              placeholder="Répéter le PIN"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">Limites de visionnage & Minuteur</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  timerEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {timerEnabled ? '⏱️ Actif' : '♾️ Illimité'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {timerEnabled
                  ? 'Le visionnage s’arrêtera automatiquement au terme de la durée configurée.'
                  : 'Désactivé (Visionnage libre sans contrainte de temps).'}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={timerEnabled}
              onClick={() => {
                const next = !timerEnabled
                setTimerEnabled(next)
                if (!next) {
                  set('dailyLimitMin', '')
                  set('sessionLimitMin', '')
                } else if (!form.dailyLimitMin) {
                  set('dailyLimitMin', '60')
                }
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                timerEnabled ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span className="sr-only">Activer ou désactiver le minuteur</span>
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  timerEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {timerEnabled && (
            <div className="space-y-4 pt-2 border-t border-gray-100 animate-fadeIn">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Sélection rapide de la limite :
                </label>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 45, 60, 90, 120].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => set('dailyLimitMin', String(mins))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        form.dailyLimitMin === String(mins)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                      }`}
                    >
                      {mins < 60 ? `${mins} min` : mins === 60 ? '1 heure' : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Limite journalière (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={form.dailyLimitMin}
                    onChange={e => set('dailyLimitMin', e.target.value)}
                    placeholder="Ex : 60"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Limite par session (min)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={form.sessionLimitMin}
                    onChange={e => set('sessionLimitMin', e.target.value)}
                    placeholder="Optionnelle"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full h-11 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Création...' : 'Créer le profil'}
        </button>
      </form>
    </div>
  )
}
