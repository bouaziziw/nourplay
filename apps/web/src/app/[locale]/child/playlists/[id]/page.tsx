'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { useChildSession } from '../../../../../hooks/useChildSession'
import { useOfflinePlaylists, readOfflinePlaylist } from '../../../../../hooks/useOfflinePlaylists'
import { api, PlaylistDetail } from '../../../../../lib/api'
import { RemoteImage } from '../../../../../components/RemoteImage'

const VIDEOS_PER_PAGE = 12

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

function offlineToPlaylistDetail(p: ReturnType<typeof readOfflinePlaylist>): PlaylistDetail | null {
  if (!p) return null
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    visibility: 'PRIVATE',
    targetAgeGroup: [],
    languages: [],
    scheduledPublishAt: null,
    createdAt: p.savedAt,
    playlistVideos: p.videos.map((v, i) => ({
      id: `${p.id}-${v.id}`,
      position: i + 1,
      video: v,
    })),
  }
}

export default function ChildPlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const { session } = useChildSession()
  const { saved, save, remove } = useOfflinePlaylists()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOfflineFallback, setIsOfflineFallback] = useState(false)
  const [page, setPage] = useState(1)

  const isSaved = saved.some(p => p.id === id)

  useEffect(() => {
    if (!token) return
    api.playlists.getById(token, id, session?.profileId)
      .then(p => { setPlaylist(p); setIsOfflineFallback(false) })
      .catch(() => {
        const offline = offlineToPlaylistDetail(readOfflinePlaylist(id))
        if (offline) {
          setPlaylist(offline)
          setIsOfflineFallback(true)
        } else {
          router.replace(`/${locale}/child`)
        }
      })
      .finally(() => setLoading(false))
  }, [token, id, locale, router, session?.profileId])

  const handleToggleSave = async () => {
    if (!playlist) return
    setSaving(true)
    try {
      if (isSaved) {
        await remove(id)
      } else {
        await save(playlist)
      }
    } finally {
      setSaving(false)
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

  const videos = playlist.playlistVideos.sort((a, b) => a.position - b.position)
  const pageCount = Math.ceil(videos.length / VIDEOS_PER_PAGE)
  const visibleVideos = videos.slice((page - 1) * VIDEOS_PER_PAGE, page * VIDEOS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 text-gray-600 hover:bg-white transition-colors shadow-sm flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{playlist.name}</h1>
          <p className="text-sm text-gray-500">{videos.length} vidéo{videos.length !== 1 ? 's' : ''}</p>
        </div>
        {!isOfflineFallback && (
          <button
            onClick={handleToggleSave}
            disabled={saving}
            title={isSaved ? 'Supprimer de l\'accès hors ligne' : 'Enregistrer hors ligne'}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              saving ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
              : isSaved ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              : 'bg-white/80 text-gray-600 hover:bg-white border border-gray-200'
            }`}
          >
            {saving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isSaved ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {isSaved ? 'Enregistré' : 'Enregistrer'}
          </button>
        )}
      </div>

      {/* Offline fallback banner */}
      {isOfflineFallback && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 3v1m0 16v1M3 12h1m16 0h1" />
          </svg>
          Mode hors ligne — les vidéos nécessitent une connexion Internet.
        </div>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-500">Aucune vidéo disponible pour le moment.</p>
        </div>
      ) : (
        <>
          <div
            aria-label="Vidéos de la playlist"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
          {visibleVideos.map(({ video, position }) => (
            <Link
              key={video.id}
              href={`/${locale}/child/watch/${video.id}?playlist=${id}`}
              className="group overflow-hidden rounded-2xl bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            >
              {/* Thumbnail */}
              <div className="relative w-full bg-gray-200" style={{ paddingBottom: '56.25%' }}>
                {video.thumbnailUrl ? (
                  <RemoteImage
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                    <span className="text-4xl">🎥</span>
                  </div>
                )}
                {/* Big play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                    <svg className="w-7 h-7 text-indigo-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {video.durationSec && (
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md">
                    {formatDuration(video.durationSec)}
                  </span>
                )}
                <span className="absolute top-2 left-2 bg-indigo-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                  {position}
                </span>
              </div>
              {/* Title */}
              <div className="p-3">
                <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{video.title}</p>
              </div>
            </Link>
          ))}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Pagination des vidéos" className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-500">Page {page} sur {pageCount}</span>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(pageCount, current + 1))}
                disabled={page === pageCount}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
