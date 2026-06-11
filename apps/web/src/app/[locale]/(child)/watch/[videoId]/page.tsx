'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { useChildSession } from '../../../../../hooks/useChildSession'
import { VideoPlayer } from '../../../../../components/VideoPlayer'
import { api, PlaylistDetail, VideoSummary } from '../../../../../lib/api'

export default function ChildWatchPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const searchParams = useSearchParams()
  const playlistId = searchParams.get('playlist') ?? ''
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const { session } = useChildSession()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [similarVideos, setSimilarVideos] = useState<VideoSummary[]>([])

  useEffect(() => {
    if (!token || !playlistId) {
      setLoading(false)
      return
    }
    api.playlists.getById(token, playlistId)
      .then(setPlaylist)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, playlistId])

  useEffect(() => {
    if (!token || !videoId) return
    api.videos.getSimilar(token, videoId)
      .then(setSimilarVideos)
      .catch(() => {})
  }, [token, videoId])

  const handleWatched = (durationSec: number, completed: boolean) => {
    if (!token || !session?.profileId) return
    api.users.recordWatch(token, session.profileId, {
      videoId,
      durationWatchedSec: durationSec,
      completed,
    }).catch(() => {})
  }

  const video = playlist?.playlistVideos.find(pv => pv.video.id === videoId)?.video
  const currentIndex = playlist?.playlistVideos.findIndex(pv => pv.video.id === videoId) ?? -1
  const sortedVideos = playlist
    ? [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
    : []
  const currentSortedIndex = sortedVideos.findIndex(pv => pv.video.id === videoId)
  const nextVideo = sortedVideos[currentSortedIndex + 1]?.video ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🎬</p>
        <p className="text-gray-500 mb-4">Vidéo introuvable.</p>
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:underline text-sm"
        >
          ← Retour
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour à la playlist
      </button>

      {/* Player */}
      <VideoPlayer
        key={videoId}
        embedUrl={video.embedUrl}
        title={video.title}
        onWatched={handleWatched}
      />

      {/* Video title */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
        <h1 className="font-bold text-gray-900 text-lg leading-snug">{video.title}</h1>
        {playlist && (
          <p className="text-sm text-gray-500 mt-1">
            {playlist.name}
            {currentSortedIndex >= 0 && (
              <span className="ml-2 text-xs text-gray-400">
                · #{sortedVideos[currentSortedIndex]?.position}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Similar videos */}
      {similarVideos.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">Vous pourriez aimer</p>
          <div className="grid grid-cols-2 gap-3">
            {similarVideos.map(sv => (
              <button
                key={sv.id}
                onClick={() => router.push(`/${locale}/child/watch/${sv.id}${playlistId ? `?playlist=${playlistId}` : ''}`)}
                className="text-left group"
              >
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-1.5" style={{ paddingBottom: '56.25%' }}>
                  {sv.thumbnailUrl ? (
                    <img src={sv.thumbnailUrl} alt={sv.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {sv.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next video */}
      {nextVideo && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">Suivant</p>
          <button
            onClick={() => router.push(`/${locale}/child/watch/${nextVideo.id}?playlist=${playlistId}`)}
            className="w-full flex items-center gap-3 text-left group"
          >
            <div className="w-24 flex-shrink-0 relative bg-gray-100 rounded-lg overflow-hidden" style={{ paddingBottom: '42%' }}>
              {nextVideo.thumbnailUrl ? (
                <img
                  src={nextVideo.thumbnailUrl}
                  alt={nextVideo.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🎥</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {nextVideo.title}
              </p>
            </div>
            <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
