'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import QRCode from 'qrcode'
import { useAuth } from '../../../../../../hooks/useAuth'
import { api, PlaylistDetail, VideoSearchResult, PlaylistAccess } from '../../../../../../lib/api'
import { RemoteImage } from '../../../../../../components/RemoteImage'

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
  const searchParams = useSearchParams()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  const [meta, setMeta] = useState({
    name: '',
    description: '',
    visibility: 'PRIVATE',
    targetAgeGroup: [] as string[],
    languages: '',
  })

  // Schedule
  const [scheduleValue, setScheduleValue] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<string | null | undefined>(undefined)
  const [scheduleError, setScheduleError] = useState('')

  // Sharing
  const [shareEmail, setShareEmail] = useState('')
  const [shareRole, setShareRole] = useState<'VIEWER' | 'EDITOR'>('VIEWER')
  const [sharing, setSharing] = useState(false)
  const [shareResult, setShareResult] = useState<PlaylistAccess | null>(null)
  const [shareError, setShareError] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [showQr, setShowQr] = useState(false)

  // Video search
  const [searchQ, setSearchQ] = useState('')
  const [searchLang, setSearchLang] = useState('')
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingVideoId, setAddingVideoId] = useState<string | null>(null)
  const [removingVideoId, setRemovingVideoId] = useState<string | null>(null)
  const [approvingVideoId, setApprovingVideoId] = useState<string | null>(null)
  const [approvingPlaylist, setApprovingPlaylist] = useState(false)
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [editedVideoTitle, setEditedVideoTitle] = useState('')

  const readImportCount = (key: string) => {
    const value = Number(searchParams.get(key))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  }
  const importResult = searchParams.has('imported')
    ? {
        imported: readImportCount('imported'),
        pending: readImportCount('pending'),
        skipped: readImportCount('skipped'),
        queueFailed: readImportCount('queueFailed'),
      }
    : null

  const handleDuplicate = async () => {
    if (!token) return
    setDuplicating(true)
    try {
      const copy = await api.playlists.duplicate(token, id)
      router.push(`/${locale}/dashboard/playlists/${copy.id}/edit`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la duplication.')
    } finally {
      setDuplicating(false)
    }
  }

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
        if (pl.scheduledPublishAt) {
          // Convert ISO string to datetime-local format (yyyy-MM-ddTHH:mm)
          setScheduleValue(pl.scheduledPublishAt.slice(0, 16))
        }
      })
      .catch(() => router.replace(`/${locale}/dashboard`))
      .finally(() => setLoading(false))
  }, [token, id, locale, router])

  useEffect(() => { load() }, [load])

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !shareEmail.trim()) return
    setSharing(true)
    setShareError('')
    setShareResult(null)
    try {
      const result = await api.playlists.share(token, id, { email: shareEmail.trim(), role: shareRole })
      setShareResult(result)
      setShareEmail('')
    } catch (err: unknown) {
      setShareError(err instanceof Error ? err.message : 'Erreur lors du partage.')
    } finally {
      setSharing(false)
    }
  }

  const handleGenerateLink = async () => {
    if (!token) return
    setGeneratingLink(true)
    try {
      const { shareToken } = await api.playlists.generateShareLink(token, id)
      const link = `${window.location.origin}/${locale}/shared/${shareToken}`
      setShareLink(link)
      const dataUrl = await QRCode.toDataURL(link, { width: 256, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
      setQrDataUrl(dataUrl)
      load()
    } catch {
      // ignore
    } finally {
      setGeneratingLink(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

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

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setScheduling(true)
    setScheduleError('')
    try {
      const result = await api.playlists.schedule(token, id, scheduleValue || null)
      setScheduleResult(result.scheduledPublishAt)
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Erreur lors de la planification.')
    } finally {
      setScheduling(false)
    }
  }

  const handleClearSchedule = async () => {
    if (!token) return
    setScheduling(true)
    try {
      await api.playlists.schedule(token, id, null)
      setScheduleValue('')
      setScheduleResult(null)
    } catch {
      // ignore
    } finally {
      setScheduling(false)
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

  const handleApproveVideo = async (videoId: string) => {
    if (!token) return
    setApprovingVideoId(videoId)
    setError('')
    try {
      await api.videos.approveSubmission(token, videoId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer la validation de cette vidéo.')
    } finally {
      setApprovingVideoId(null)
    }
  }

  const handleApprovePlaylist = async () => {
    if (!token) return
    setApprovingPlaylist(true)
    setError('')
    try {
      const { queued } = await api.videos.approvePlaylistSubmissions(token, id)
      await load()
      setError(queued > 0 ? '' : 'Aucune vidéo en attente à envoyer en validation.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer la validation des vidéos.')
    } finally {
      setApprovingPlaylist(false)
    }
  }

  const handleSaveVideoTitle = async (videoId: string) => {
    if (!token || !editedVideoTitle.trim()) return
    setError('')
    try {
      const updated = await api.videos.updateSubmission(token, videoId, { title: editedVideoTitle.trim() })
      setPlaylist(current => current ? {
        ...current,
        playlistVideos: current.playlistVideos.map(item => item.video.id === videoId
          ? { ...item, video: { ...item.video, title: updated.title } }
          : item),
      } : null)
      setEditingVideoId(null)
      setEditedVideoTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de modifier cette vidéo.')
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
  const pendingValidationVideos = sortedVideos.filter(pv => pv.video.validationStatus === 'PENDING')

  return (
    <div className="w-full space-y-6">
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
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
          title="Créer une copie de cette playlist"
        >
          {duplicating ? '…' : 'Dupliquer'}
        </button>
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

      {importResult && (
        <div role="status" className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-sm text-indigo-900">
          <p>{importResult.imported} vidéo{importResult.imported !== 1 ? 's' : ''} importée{importResult.imported !== 1 ? 's' : ''} dans cette playlist.</p>
          {importResult.pending > 0 && (
            <p className="mt-1">
              {importResult.pending} vidéo{importResult.pending !== 1 ? 's sont' : ' est'} en cours de validation automatique prioritaire.
              {' '}
              <Link href={`/${locale}/dashboard/approvals`} className="font-medium underline">
                Suivre leur statut
              </Link>
            </p>
          )}
          {importResult.skipped > 0 && (
            <p className="mt-1">
              {importResult.skipped} vidéo{importResult.skipped !== 1 ? 's n’ont pas pu être ajoutées' : ' n’a pas pu être ajoutée'} car {importResult.skipped !== 1 ? 'elles sont' : 'elle est'} indisponible ou en cours de validation.
            </p>
          )}
          {importResult.queueFailed > 0 && (
            <p role="alert" className="mt-1 text-red-700">
              {importResult.queueFailed} vidéo{importResult.queueFailed === 1 ? ' n’a pas pu être envoyée' : 's n’ont pas pu être envoyées'} en validation automatique. Contactez un administrateur pour relancer la file.
            </p>
          )}
        </div>
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
              {pendingValidationVideos.length > 0 && (
                <button
                  type="button"
                  onClick={handleApprovePlaylist}
                  disabled={approvingPlaylist || Boolean(approvingVideoId)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approvingPlaylist
                    ? 'Envoi en validation…'
                    : `Relancer la validation (${pendingValidationVideos.length})`}
                </button>
              )}
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
                        ? <RemoteImage src={pv.video.thumbnailUrl} alt="" fill className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm">🎥</div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingVideoId === pv.video.id ? (
                        <form
                          className="flex gap-1"
                          onSubmit={event => {
                            event.preventDefault()
                            void handleSaveVideoTitle(pv.video.id)
                          }}
                        >
                          <input
                            autoFocus
                            value={editedVideoTitle}
                            onChange={event => setEditedVideoTitle(event.target.value)}
                            maxLength={200}
                            required
                            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                            aria-label="Titre de la vidéo"
                          />
                          <button type="submit" className="text-xs font-medium text-indigo-600">OK</button>
                          <button type="button" onClick={() => setEditingVideoId(null)} className="text-xs text-gray-500">Annuler</button>
                        </form>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">{pv.video.title}</p>
                      )}
                      {pv.video.durationSec && (
                        <p className="text-xs text-gray-400">{formatDuration(pv.video.durationSec)}</p>
                      )}
                      {pv.video.validationStatus && pv.video.validationStatus !== 'APPROVED' && (
                        <p className="text-xs text-amber-700">
                          {pv.video.validationStatus === 'PENDING'
                            ? 'Validation automatique en cours'
                            : pv.video.validationStatus === 'NEEDS_REVIEW' ? 'En attente de modération'
                              : 'Vidéo refusée'}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {pv.video.validationStatus === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVideoId(pv.video.id)
                              setEditedVideoTitle(pv.video.title)
                            }}
                            className="rounded px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApproveVideo(pv.video.id)}
                            disabled={Boolean(approvingVideoId) || approvingPlaylist}
                            className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {approvingVideoId === pv.video.id ? 'Relance…' : 'Relancer'}
                          </button>
                        </>
                      )}
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
                        ? <RemoteImage src={v.thumbnailUrl} alt="" width={56} height={40} className="w-full h-full object-cover" />
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

      {/* Schedule panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Publication programmée</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            La playlist passera automatiquement en lien public à la date choisie.
          </p>
        </div>

        {playlist.scheduledPublishAt && scheduleResult === undefined ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Programmée pour le{' '}
              <span className="font-medium">
                {new Date(playlist.scheduledPublishAt).toLocaleString('fr-FR', {
                  dateStyle: 'medium', timeStyle: 'short',
                })}
              </span>
            </span>
            <button
              onClick={handleClearSchedule}
              disabled={scheduling}
              className="text-xs text-red-500 hover:text-red-700 underline transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        ) : scheduleResult !== undefined && scheduleResult !== null ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-green-700">
              ✓ Programmée pour le{' '}
              {new Date(scheduleResult).toLocaleString('fr-FR', {
                dateStyle: 'medium', timeStyle: 'short',
              })}
            </span>
            <button
              onClick={handleClearSchedule}
              disabled={scheduling}
              className="text-xs text-red-500 hover:text-red-700 underline transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        ) : scheduleResult === null ? (
          <p className="text-sm text-gray-400">Aucune publication programmée.</p>
        ) : null}

        <form onSubmit={handleSchedule} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Date et heure</label>
            <input
              type="datetime-local"
              value={scheduleValue}
              onChange={e => setScheduleValue(e.target.value)}
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={scheduling || !scheduleValue}
            className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {scheduling ? '…' : 'Programmer'}
          </button>
        </form>

        {scheduleError && (
          <p className="text-xs text-red-600">{scheduleError}</p>
        )}
      </div>

      {/* Sharing panel — visible when not private */}
      {meta.visibility !== 'PRIVATE' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Partage</h2>

          {/* Invite by email — only for SHARED_USERS */}
          {meta.visibility === 'SHARED_USERS' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Inviter un utilisateur par email</p>
              <form onSubmit={handleShare} className="flex flex-wrap gap-2 items-end">
                <input
                  type="email"
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  required
                  className="flex-1 min-w-48 h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={shareRole}
                  onChange={e => setShareRole(e.target.value as 'VIEWER' | 'EDITOR')}
                  className="h-9 px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="VIEWER">Lecteur</option>
                  <option value="EDITOR">Éditeur</option>
                </select>
                <button
                  type="submit"
                  disabled={sharing}
                  className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {sharing ? '…' : 'Inviter'}
                </button>
              </form>
              {shareError && <p className="text-xs text-red-600">{shareError}</p>}
              {shareResult && (
                <p className="text-xs text-green-600">
                  Accès accordé ({shareResult.role === 'EDITOR' ? 'éditeur' : 'lecteur'}).
                </p>
              )}
            </div>
          )}

          {/* Share link — only for SHARED_LINK */}
          {meta.visibility === 'SHARED_LINK' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Lien de partage public</p>
              {shareLink ? (
                <>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareLink}
                      className="flex-1 h-9 px-3 border border-gray-300 rounded-lg text-sm bg-gray-50 text-gray-700 font-mono"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="h-9 px-4 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {linkCopied ? '✓ Copié' : 'Copier'}
                    </button>
                    <button
                      onClick={() => setShowQr(v => !v)}
                      title="Afficher le QR code"
                      className={`h-9 px-3 border rounded-lg text-sm transition-colors ${showQr ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4H4v8h8V4zM20 4h-8v8h8V4zM12 12H4v8h8v-8z" />
                        <rect x="16" y="16" width="4" height="4" fill="currentColor" stroke="none" rx="0.5" />
                      </svg>
                    </button>
                  </div>

                  {showQr && qrDataUrl && (
                    <div className="flex flex-col items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <RemoteImage
                        src={qrDataUrl}
                        alt="QR code de partage"
                        width={192}
                        height={192}
                        className="w-48 h-48 rounded-lg border border-gray-200"
                      />
                      <a
                        href={qrDataUrl}
                        download={`qr-${id}.png`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Télécharger PNG
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                  className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {generatingLink ? '…' : 'Générer un lien'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
