'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, ProfileSummary } from '../../../../../lib/api'

const AGE_GROUPS = [
  { value: 'AGE_0_3', label: '0–3 ans' },
  { value: 'AGE_4_6', label: '4–6 ans' },
  { value: 'AGE_7_9', label: '7–9 ans' },
  { value: 'AGE_10_12', label: '10–12 ans' },
  { value: 'AGE_13_15', label: '13–15 ans' },
]

const DAYS = [
  { key: 'mon', label: 'Lun' }, { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' }, { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' }, { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
]

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

export default function EditProfilePage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [profile, setProfile] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'settings' | 'history'>('settings')

  const [form, setForm] = useState({
    displayName: '',
    ageGroup: 'AGE_4_6',
    dailyLimitMin: '',
    sessionLimitMin: '',
    schedule: {} as Record<string, string>,
  })
  const [history, setHistory] = useState<Array<{
    id: string; watchedAt: string; durationWatchedSec: number; completed: boolean
    video: { id: string; title: string; thumbnailUrl: string | null }
  }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    api.users.getProfile(token, id)
      .then(p => {
        setProfile(p)
        const sched = p.viewingSchedule ?? {}
        setForm({
          displayName: p.displayName,
          ageGroup: p.ageGroup,
          dailyLimitMin: p.dailyLimitMin ? String(p.dailyLimitMin) : '',
          sessionLimitMin: p.sessionLimitMin ? String(p.sessionLimitMin) : '',
          schedule: Object.fromEntries(DAYS.map(d => [d.key, (sched[d.key] ?? []).join(', ')])),
        })
      })
      .catch(() => router.replace(`/${locale}/dashboard`))
      .finally(() => setLoading(false))
  }, [token, id, locale, router])

  useEffect(() => {
    if (tab !== 'history' || !token) return
    setHistoryLoading(true)
    api.users.getWatchHistory(token, id)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [tab, token, id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')

    const schedule: Record<string, string[]> = {}
    for (const d of DAYS) {
      const raw = form.schedule[d.key]?.trim()
      if (raw) schedule[d.key] = raw.split(',').map(s => s.trim()).filter(Boolean)
    }

    try {
      await api.users.updateProfile(token, id, {
        displayName: form.displayName.trim(),
        ageGroup: form.ageGroup,
        dailyLimitMin: form.dailyLimitMin ? Number(form.dailyLimitMin) : null,
        sessionLimitMin: form.sessionLimitMin ? Number(form.sessionLimitMin) : null,
        viewingSchedule: Object.keys(schedule).length ? schedule : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!token || !confirm(`Supprimer le profil "${profile?.displayName}" ?`)) return
    setDeleting(true)
    try {
      await api.users.deleteProfile(token, id)
      router.replace(`/${locale}/dashboard`)
    } catch {
      setError('Impossible de supprimer ce profil.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
            {profile.displayName.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['settings', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'settings' ? 'Paramètres' : 'Historique'}
          </button>
        ))}
      </div>

      {tab === 'settings' && (
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="font-semibold text-gray-900">Informations</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom affiché</label>
              <input
                type="text"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                required
                maxLength={30}
                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tranche d'âge</label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, ageGroup: g.value }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
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
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Limites de visionnage</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Limite journalière (min)</label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={form.dailyLimitMin}
                  onChange={e => setForm(f => ({ ...f, dailyLimitMin: e.target.value }))}
                  placeholder="Illimitée"
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
                  onChange={e => setForm(f => ({ ...f, sessionLimitMin: e.target.value }))}
                  placeholder="Illimitée"
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Plages horaires autorisées</h2>
              <p className="text-xs text-gray-400 mt-0.5">Format : <code>08:00-12:00, 14:00-18:00</code></p>
            </div>
            <div className="space-y-2.5">
              {DAYS.map(d => (
                <div key={d.key} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-medium text-gray-500">{d.label}</span>
                  <input
                    type="text"
                    value={form.schedule[d.key] ?? ''}
                    onChange={e => setForm(f => ({ ...f, schedule: { ...f.schedule, [d.key]: e.target.value } }))}
                    placeholder="Toute la journée"
                    className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-11 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="h-11 px-4 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? '...' : 'Supprimer'}
            </button>
          </div>
        </form>
      )}

      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {historyLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-6 w-6 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucune vidéo regardée.</div>
          ) : (
            history.map(h => (
              <div key={h.id} className="flex items-center gap-3 p-4">
                <div className="w-14 h-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
                  {h.video.thumbnailUrl
                    ? <img src={h.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-lg">🎥</div>
                  }
                  {h.completed && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <span className="text-green-600 text-xs font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{h.video.title}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(h.watchedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {h.durationWatchedSec > 0 && ` · ${formatDuration(h.durationWatchedSec)}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
