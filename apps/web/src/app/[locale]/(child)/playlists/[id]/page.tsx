'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, PlaylistDetail } from '../../../../../lib/api'

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

export default function ChildPlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api.playlists.getById(token, id)
      .then(setPlaylist)
      .catch(() => router.replace(`/${locale}/child`))
      .finally(() => setLoading(false))
  }, [token, id, locale, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!playlist) return null

  const videos = playlist.playlistVideos.sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 text-gray-600 hover:bg-white transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{playlist.name}</h1>
          <p className="text-sm text-gray-500">{videos.length} vidéo{videos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-500">Aucune vidéo disponible pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map(({ video, position }) => (
            <Link
              key={video.id}
              href={`/${locale}/child/watch/${video.id}?playlist=${id}`}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
            >
              {/* Thumbnail */}
              <div className="relative w-full bg-gray-200" style={{ paddingBottom: '56.25%' }}>
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
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
      )}
    </div>
  )
}
