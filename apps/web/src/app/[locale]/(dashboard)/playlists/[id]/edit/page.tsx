'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '../../../../../../hooks/useAuth'
import { api, PlaylistDetail, VideoSearchResult } from '../../../../../../lib/api'

const AGE_GROUPS = [
  { value: 'AGE_0_3', label: '0–3' },
  { value: 'AGE_4_6', label: '4–6' },
  { value: 'AGE_7_9', label: '7–9' },
  { value: 'AGE_10_12', label: '10–12' },
  { value: 'AGE_13_15', label: '13–15' },
]

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Privée' },
  { value: 'SHARED_USERS', label: 'Partagée' },
  { value: 'SHARED_LINK', label: 'Lien public' },
]

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

export default function EditPlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [meta, setMeta] = useState({
    name: '',
    description: '',
    visibility: 'PRIVATE',
    targetAgeGroup: [] as string[],
    languages: '',
  })

  // Video search
  const [searchQ, setSearchQ] = useState('')
  const [searchLang, setSearchLang] = useState('')
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null)
  const [removingVideoId, setRemovingVideoId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    api.playlists.getById(token, id)
      .then(pl => {
        setPlaylist(pl)
        setMeta({
          name: pl.name,
          description: pl.description ?? '',
          visibility: pl.visibility,
          targetAgeGroup: pl.targetAgeGroup ?? [],
          languages: (pl.languages ?? []).join(', '),
        })
      })
      .catch(() => router.replace(`/${locale}/dashboard`))
      .finally(() => setLoading(false))
  }, [token, id, locale, router])

  useEffect(() => { load() }, [load])

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')
    try {
      await api.playlists.update(token, id, {
        name: meta.name.trim(),
        description: meta.description.trim() || undefined,
        visibility: meta.visibility,
        targetAgeGroup: meta.targetAgeGroup,
        languages: meta.languages ? meta.languages.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSearching(true)
    try {
      const res = await api.videos.search(token, { q: searchQ, language: searchLang || undefined, limit: 20 })
      setSearchResults(res.items)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleAddVideo = async (videoId: string) => {
    if (!token) return
    setAddingVideoId(videoId)
    try {
      await api.playlists.addVideo(token, id, videoId)
      load()
    } catch {
      setError('Impossible d\'ajouter la vidéo.')
    } finally {
      setAddingVideoId(null)
    }
  }

  const handleRemoveVideo = async (videoId: string) => {
    if (!token) return
    setRemovingVideoId(videoId)
    try {
      await api.playlists.removeVideo(token, id, videoId)
      setPlaylist(pl => pl
        ? { ...pl, playlistVideos: pl.playlistVideos.filter(pv => pv.video.id !== videoId) }
        : null)
    } catch {
      setError('Impossible de retirer la vidéo.')
    } finally {
      setRemovingVideoId(null)
    }
  }

  const moveVideo = async (videoId: string, direction: -1 | 1) => {
    if (!playlist || !token) return
    const sorted = [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
    const idx = sorted.findIndex(pv => pv.video.id === videoId)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= sorted.length) return

    const newOrder = [...sorted]
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]
    const videoIds = newOrder.map(pv => pv.video.id)

    setPlaylist(pl => pl ? { ...pl, playlistVideos: newOrder.map((pv, i) => ({ ...pv, position: i + 1 })) } : null)
    try {
      await api.playlists.reorderVideos(token, id, videoIds)
    } catch {
      load()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!playlist) return null

  const sortedVideos = [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
  const playlistVideoIds = new Set(playlist.playlistVideos.map(pv => pv.video.id))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{playlist.name}</h1>
          <p className="text-sm text-gray-400">{sortedVideos.length} vidéo{sortedVideos.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href={`/${locale}/dashboard/playlists/${id}`}
          className="text-sm text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          Aperçu
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — metadata + video list */}
        <div className="space-y-5">
          {/* Metadata */}
          <form onSubmit={handleSaveMeta} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Informations</h2>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom</label>
              <input
                type="text"
                value={meta.name}
                onChange={e => setMeta(m => ({ ...m, name: e.target.value }))}
                required
                maxLength={100}
                className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={meta.description}
                onChange={e => setMeta(m => ({ ...m, description: e.target.value }))}
                maxLength={500}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Visibilité</label>
                <select
                  value={meta.visibility}
                  onChange={e => setMeta(m => ({ ...m, visibility: e.target.value }))}
                  className="w-full h-9 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {VISIBILITY_OPTIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Langues</label>
                <input
                  type="text"
                  value={meta.languages}
                  onChange={e => setMeta(m => ({ ...m, languages: e.target.value }))}
                  placeholder="fr, en"
                  className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Âges cibles</label>
              <div className="flex flex-wrap gap-1.5">
                {AGE_GROUPS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setMeta(m => ({
                      ...m,
                      targetAgeGroup: m.targetAgeGroup.includes(g.value)
                        ? m.targetAgeGroup.filter(v => v !== g.value)
                        : [...m.targetAgeGroup, g.value],
                    }))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      meta.targetAgeGroup.includes(g.value)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-9 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saved ? '✓ Sauvegardé' : saving ? '...' : 'Sauvegarder'}
            </button>
          </form>

          {/* Video list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Vidéos ({sortedVideos.length})</h2>
            </div>
            {sortedVideos.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                Aucune vidéo — recherchez à droite pour en ajouter.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedVideos.map((pv, idx) => (
                  <div key={pv.video.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-5 text-xs text-center text-gray-400 font-medium">{pv.position}</span>
                    <div className="w-12 h-9 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative">
                      {pv.video.thumbnailUrl
                        ? <img src={pv.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm">🎥</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{pv.video.title}</p>
                      {pv.video.durationSec && (
                        <p className="text-xs text-gray-400">{formatDuration(pv.video.durationSec)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveVideo(pv.video.id, -1)}
                        disabled={idx === 0}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveVideo(pv.video.id, 1)}
                        disabled={idx === sortedVideos.length - 1}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRemoveVideo(pv.video.id)}
                        disabled={removingVideoId === pv.video.id}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — video search */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Ajouter des vidéos</h2>
          </div>

          <div className="p-4 border-b border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Rechercher une vidéo..."
                className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <input
                type="text"
                value={searchLang}
                onChange={e => setSearchLang(e.target.value)}
                placeholder="Langue"
                className="w-20 h-9 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={searching}
                className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {searching ? '...' : 'OK'}
              </button>
            </form>
            <p className="text-xs text-gray-400 mt-2">
              Ou <Link href={`/${locale}/dashboard/videos/new`} className="text-indigo-600 hover:underline">soumettre une nouvelle vidéo</Link>
            </p>
          </div>

          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {searchResults.length === 0 && !searching ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {searchQ ? 'Aucun résultat.' : 'Lancez une recherche pour trouver des vidéos approuvées.'}
              </div>
            ) : (
              searchResults.map(v => {
                const alreadyAdded = playlistVideoIds.has(v.id)
                return (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-14 h-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                      {v.thumbnailUrl
                        ? <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm">🎥</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{v.title}</p>
                      <p className="text-xs text-gray-400">
                        {v.language?.toUpperCase()}
                        {v.durationSec && ` · ${formatDuration(v.durationSec)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => !alreadyAdded && handleAddVideo(v.id)}
                      disabled={alreadyAdded || addingVideoId === v.id}
                      className={`flex-shrink-0 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                        alreadyAdded
                          ? 'bg-green-50 text-green-600 border border-green-200 cursor-default'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                      }`}
                    >
                      {alreadyAdded ? '✓ Ajoutée' : addingVideoId === v.id ? '...' : '+ Ajouter'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
