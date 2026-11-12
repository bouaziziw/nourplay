'use client'

import { useState } from 'react'
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
        ...(form.dailyLimitMin && { dailyLimitMin: Number(form.dailyLimitMin) }),
        ...(form.sessionLimitMin && { sessionLimitMin: Number(form.sessionLimitMin) }),
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
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
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

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Contrôles parentaux <span className="text-gray-400 font-normal">(optionnel)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Limite journalière (min)</label>
              <input
                type="number"
                min={1}
                max={480}
                value={form.dailyLimitMin}
                onChange={e => set('dailyLimitMin', e.target.value)}
                placeholder="Ex : 60"
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Limite par session (min)</label>
              <input
                type="number"
                min={1}
                max={120}
                value={form.sessionLimitMin}
                onChange={e => set('sessionLimitMin', e.target.value)}
                placeholder="Ex : 30"
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
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
