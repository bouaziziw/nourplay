'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, PlaylistDetail } from '../../../../../lib/api'
import { RemoteImage } from '../../../../../components/RemoteImage'

const VIDEOS_PER_PAGE = 12

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`
}

export default function ParentPlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(VIDEOS_PER_PAGE)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const handleExport = async () => {
    if (!token || !playlist) return
    setExporting(true)
    try {
      const blob = await api.playlists.exportCsv(token, id)
      const safe = playlist.name.replace(/[^a-z0-9_\-]/gi, '_').toLowerCase()
      downloadBlob(blob, `playlist-${safe}.csv`)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    if (!token) return
    api.playlists.getById(token, id)
      .then(setPlaylist)
      .catch(() => setError('Impossible de charger la playlist'))
      .finally(() => setLoading(false))
  }, [token, id])

  const videos = playlist ? playlist.playlistVideos.sort((a, b) => a.position - b.position) : []
  const hasMore = visibleCount < videos.length
  const visibleVideos = videos.slice(0, visibleCount)

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          setLoadingMore(true)
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + VIDEOS_PER_PAGE, videos.length))
            setLoadingMore(false)
          }, 150)
        }
      },
      { rootMargin: '250px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, videos.length])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !playlist) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{error || 'Playlist introuvable'}</p>
        <button onClick={() => router.back()} className="mt-4 text-[#1c90d8] hover:underline text-sm font-medium">← Retour</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-gray-500 text-sm mt-1">{playlist.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">{videos.length} vidéo{videos.length !== 1 ? 's' : ''}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
              {playlist.visibility.toLowerCase().replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          <Link
            href={`/${locale}/dashboard/playlists/${id}/edit`}
            className="rounded-xl bg-[#1c90d8] px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#1572ab] shadow-sm"
          >
            Ajouter des vidéos
          </Link>
          <button
            onClick={handleExport}
            disabled={exporting || videos.length === 0}
            className="text-sm text-gray-600 font-medium border border-gray-200 rounded-xl px-3.5 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
            title="Exporter en CSV"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Export…' : 'CSV'}
          </button>
          <Link
            href={`/${locale}/child`}
            className="text-sm text-[#1c90d8] font-medium border border-sky-200 bg-sky-50 rounded-xl px-3.5 py-1.5 hover:bg-sky-100 transition-colors shadow-sm"
          >
            Mode enfant
          </Link>
        </div>
      </div>

      {/* Video grid */}
      {videos.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p className="text-gray-400 text-sm">Aucune vidéo approuvée dans cette playlist</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleVideos.map(({ video, position }) => (
            <Link
              key={video.id}
              href={`/${locale}/child/watch/${video.id}?playlist=${id}`}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-sky-300 hover:shadow-lg transition-all active:scale-[0.99]"
            >
              {/* Thumbnail */}
              <div className="relative w-full bg-gray-100" style={{ paddingBottom: '56.25%' }}>
                {video.thumbnailUrl ? (
                  <RemoteImage
                    src={video.thumbnailUrl}
                    alt={video.title}
                    fill
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-[#1c90d8] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {video.durationSec && (
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    {formatDuration(video.durationSec)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-[#1c90d8] transition-colors">{video.title}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs font-medium text-gray-400">#{position}</span>
                  {video.language && (
                    <span className="text-xs text-gray-400 uppercase font-medium">{video.language}</span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium ml-auto">
                    {video.ageRating.replace('_', '+')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel & status */}
      <div ref={sentinelRef} className="py-6 flex flex-col items-center justify-center gap-2">
        {loadingMore && (
          <div className="flex items-center gap-2 text-sm text-[#1c90d8] font-medium">
            <div className="animate-spin h-5 w-5 border-2 border-[#1c90d8] border-t-transparent rounded-full" />
            <span>Chargement des vidéos…</span>
          </div>
        )}
        {!hasMore && videos.length > VIDEOS_PER_PAGE && (
          <span className="text-xs text-gray-400 font-medium">
            Toutes les {videos.length} vidéos sont affichées
          </span>
        )}
      </div>
    </div>
  )
}
