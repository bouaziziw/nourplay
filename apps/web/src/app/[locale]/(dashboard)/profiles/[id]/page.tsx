'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, ProfileSummary, UserBlock, ProfileAnalytics, VideoFavorite } from '../../../../../lib/api'

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

function formatWatchTime(sec: number): string {
  if (sec === 0) return '0 min'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  return `${m} min`
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
  const [tab, setTab] = useState<'settings' | 'history' | 'filters' | 'stats' | 'favorites'>('settings')

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

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

  const [analytics, setAnalytics] = useState<ProfileAnalytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const [favorites, setFavorites] = useState<VideoFavorite[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)

  const [blocks, setBlocks] = useState<UserBlock[]>([])
  const [blocksLoading, setBlocksLoading] = useState(false)
  const [newBlockType, setNewBlockType] = useState('KEYWORD_BLACKLIST')
  const [newBlockValue, setNewBlockValue] = useState('')
  const [addingBlock, setAddingBlock] = useState(false)
  const [blockError, setBlockError] = useState('')

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

  useEffect(() => {
    if (tab !== 'favorites' || !token) return
    setFavoritesLoading(true)
    api.favorites.list(token, id)
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setFavoritesLoading(false))
  }, [tab, token, id])

  useEffect(() => {
    if (tab !== 'filters' || !token) return
    setBlocksLoading(true)
    api.blocks.list(token, id)
      .then(setBlocks)
      .catch(() => {})
      .finally(() => setBlocksLoading(false))
  }, [tab, token, id])

  useEffect(() => {
    if (tab !== 'stats' || !token) return
    setAnalyticsLoading(true)
    api.users.getProfileAnalytics(token, id)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, [tab, token, id])

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newBlockValue.trim()) return
    setAddingBlock(true)
    setBlockError('')
    try {
      const block = await api.blocks.create(token, { profileId: id, type: newBlockType, value: newBlockValue.trim() })
      setBlocks(prev => [block, ...prev])
      setNewBlockValue('')
    } catch (err: unknown) {
      setBlockError(err instanceof Error ? err.message : 'Erreur lors de la création.')
    } finally {
      setAddingBlock(false)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!token) return
    try {
      await api.blocks.delete(token, blockId)
      setBlocks(prev => prev.filter(b => b.id !== blockId))
    } catch {
      // ignore
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setAvatarError('')
    setAvatarUploading(true)

    try {
      const { uploadUrl, key, publicUrl } = await api.storage.getPresignedUploadUrl(token, {
        folder: 'avatars',
        contentType: file.type,
        sizeBytes: file.size,
      })

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      await api.users.updateProfile(token, id, { avatarKey: key })
      setProfile(p => p ? { ...p, avatarKey: key } : p)
      setAvatarPreview(publicUrl || URL.createObjectURL(file))
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'Erreur lors du téléversement.')
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

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
          <div className="w-10 h-10 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
            {(avatarPreview || profile.avatarKey)
              ? <img src={avatarPreview ?? `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${profile.avatarKey}`} alt="" className="w-full h-full object-cover" />
              : profile.displayName.slice(0, 2).toUpperCase()
            }
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.displayName}</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {(['settings', 'stats', 'filters', 'history', 'favorites'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'settings' ? 'Paramètres'
              : t === 'stats' ? 'Statistiques'
              : t === 'filters' ? 'Filtres'
              : t === 'history' ? 'Historique'
              : 'Favoris'}
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

            {/* Avatar upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-indigo-50 flex items-center justify-center text-xl font-bold text-indigo-400 shrink-0">
                  {(avatarPreview || profile.avatarKey)
                    ? <img src={avatarPreview ?? `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${profile.avatarKey}`} alt="" className="w-full h-full object-cover" />
                    : profile.displayName.slice(0, 2).toUpperCase()
                  }
                </div>
                <div className="space-y-1.5">
                  <label className={`inline-block cursor-pointer h-9 px-4 text-sm font-medium rounded-lg border transition-colors ${
                    avatarUploading ? 'opacity-50 pointer-events-none border-gray-200 text-gray-400' : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                  }`}>
                    {avatarUploading ? 'Téléversement…' : 'Changer la photo'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={avatarUploading}
                    />
                  </label>
                  {avatarError && <p className="text-xs text-red-600">{avatarError}</p>}
                  <p className="text-xs text-gray-400">JPG, PNG ou WebP · max 5 MB</p>
                </div>
              </div>
            </div>

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

      {tab === 'filters' && (
        <div className="space-y-5">
          {/* Add block form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Ajouter un filtre</h2>
              <p className="text-xs text-gray-500 mt-0.5">Bloquez des mots-clés dans les titres ou des chaînes spécifiques.</p>
            </div>
            <form onSubmit={handleAddBlock} className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={newBlockType}
                  onChange={e => setNewBlockType(e.target.value)}
                  className="h-9 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="KEYWORD_BLACKLIST">Mot-clé bloqué</option>
                  <option value="KEYWORD_WHITELIST">Mot-clé autorisé uniquement</option>
                  <option value="CHANNEL_BLACKLIST">Chaîne bloquée</option>
                  <option value="CHANNEL_WHITELIST">Chaîne autorisée uniquement</option>
                </select>
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs text-gray-500 mb-1">Valeur</label>
                <input
                  type="text"
                  value={newBlockValue}
                  onChange={e => setNewBlockValue(e.target.value)}
                  placeholder={newBlockType.includes('KEYWORD') ? 'ex: violence, publicité…' : 'ID ou nom de la chaîne'}
                  required
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={addingBlock}
                className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {addingBlock ? '…' : 'Ajouter'}
              </button>
            </form>
            {blockError && <p className="text-xs text-red-600">{blockError}</p>}
          </div>

          {/* Block list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {blocksLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : blocks.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Aucun filtre configuré.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {blocks.map(b => {
                  const typeLabel: Record<string, string> = {
                    KEYWORD_BLACKLIST: 'Mot-clé bloqué',
                    KEYWORD_WHITELIST: 'Mot-clé autorisé',
                    CHANNEL_BLACKLIST: 'Chaîne bloquée',
                    CHANNEL_WHITELIST: 'Chaîne autorisée',
                  }
                  const typeColor: Record<string, string> = {
                    KEYWORD_BLACKLIST: 'bg-red-50 text-red-700',
                    KEYWORD_WHITELIST: 'bg-green-50 text-green-700',
                    CHANNEL_BLACKLIST: 'bg-orange-50 text-orange-700',
                    CHANNEL_WHITELIST: 'bg-sky-50 text-sky-700',
                  }
                  return (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor[b.type] ?? 'bg-gray-100 text-gray-600'}`}>
                        {typeLabel[b.type] ?? b.type}
                      </span>
                      <span className="flex-1 text-sm text-gray-800 font-medium">{b.value}</span>
                      <button
                        onClick={() => handleDeleteBlock(b.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="space-y-5">
          {analyticsLoading || !analytics ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* Period cards */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Aujourd'hui", data: analytics.today, extra: null },
                  { label: '7 derniers jours', data: analytics.week, extra: null },
                  { label: '30 derniers jours', data: analytics.month, extra: analytics.month.completionRate },
                ].map(({ label, data, extra }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-2xl font-bold text-gray-900">{formatWatchTime(data.watchedSec)}</p>
                    <p className="text-xs text-gray-400">{data.count} vidéo{data.count !== 1 ? 's' : ''}</p>
                    {extra !== null && (
                      <div className="pt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Complétions</span>
                          <span>{extra}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${extra}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Daily bar chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Visionnage par jour (7 jours)</h3>
                {(() => {
                  const days = analytics.watchTimeByDay
                  const maxSec = Math.max(...days.map(d => d.watchedSec), 1)
                  const DAY_LABELS: Record<string, string> = {
                    '0': 'Dim', '1': 'Lun', '2': 'Mar', '3': 'Mer', '4': 'Jeu', '5': 'Ven', '6': 'Sam',
                  }
                  return (
                    <div className="flex items-end gap-1.5 h-28">
                      {days.map(({ date, watchedSec }) => {
                        const pct = Math.round((watchedSec / maxSec) * 100)
                        const dayIdx = String(new Date(date + 'T12:00:00').getDay())
                        const isToday = date === new Date().toISOString().slice(0, 10)
                        return (
                          <div key={date} className="flex flex-col items-center gap-1 flex-1">
                            {watchedSec > 0 && (
                              <span className="text-[10px] text-gray-400 leading-none">
                                {formatWatchTime(watchedSec)}
                              </span>
                            )}
                            <div className="w-full flex items-end" style={{ height: '72px' }}>
                              <div
                                className={`w-full rounded-t transition-all ${isToday ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                                style={{ height: `${Math.max(pct, watchedSec > 0 ? 8 : 2)}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-medium ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                              {DAY_LABELS[dayIdx]}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* Top videos */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Vidéos les plus regardées (30 j)</h3>
                {analytics.topVideos.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune vidéo regardée ce mois-ci.</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topVideos.map(({ video, watchCount, totalWatchedSec }, i) => (
                      <div key={video!.id} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold text-gray-300 text-right flex-shrink-0">{i + 1}</span>
                        <div className="w-12 h-8 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                          {video!.thumbnailUrl
                            ? <img src={video!.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-sm">🎥</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{video!.title}</p>
                          <p className="text-xs text-gray-400">{formatWatchTime(totalWatchedSec)} regardées</p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          ×{watchCount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'favorites' && (
        <div className="space-y-4">
          {favoritesLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : favorites.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 text-center py-14 text-gray-400 text-sm">
              Aucune vidéo en favoris pour ce profil.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {favorites.map(fav => (
                <div key={fav.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex gap-3 p-3 group">
                  <div className="w-20 h-14 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    {fav.video.thumbnailUrl
                      ? <img src={fav.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">🎥</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{fav.video.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(fav.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!token) return
                      await api.favorites.remove(token, id, fav.videoId).catch(() => {})
                      setFavorites(prev => prev.filter(f => f.id !== fav.id))
                    }}
                    title="Retirer des favoris"
                    className="self-start text-gray-300 hover:text-red-500 transition-colors mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
