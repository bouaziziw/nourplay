'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api, PlaylistDetail } from '../../../../lib/api'

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

function buildSafeEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? ''
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop() ?? ''
      return `https://player.vimeo.com/video/${id}?dnt=1`
    }
    return url
  } catch {
    return url
  }
}

export default function SharedPlaylistPage() {
  const { token } = useParams<{ token: string }>()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)

  useEffect(() => {
    api.playlists.getShared(token)
      .then(pl => {
        setPlaylist(pl)
        if (pl.playlistVideos.length > 0) {
          setActiveVideoId(pl.playlistVideos[0].video.id)
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (notFound || !playlist) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-5xl">🔒</p>
        <h1 className="text-2xl font-bold text-gray-900">Playlist introuvable</h1>
        <p className="text-gray-500 text-sm max-w-sm">
          Ce lien de partage est invalide, expiré, ou la playlist n'est plus disponible.
        </p>
      </div>
    )
  }

  const sorted = [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
  const activeVideo = sorted.find(pv => pv.video.id === activeVideoId)?.video ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <span className="text-lg font-bold text-indigo-600">NourPlay</span>
        <span className="text-xs text-gray-400">Playlist partagée</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Playlist info */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-gray-500 text-sm mt-1">{playlist.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {sorted.length} vidéo{sorted.length !== 1 ? 's' : ''}
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <p className="text-gray-400 text-sm">Cette playlist ne contient pas encore de vidéos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Player */}
            <div className="lg:col-span-2 space-y-3">
              {activeVideo && (
                <>
                  <div className="aspect-video bg-black rounded-2xl overflow-hidden">
                    <iframe
                      key={activeVideo.id}
                      src={buildSafeEmbedUrl(activeVideo.embedUrl)}
                      className="w-full h-full"
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{activeVideo.title}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {activeVideo.language?.toUpperCase()}
                      {activeVideo.durationSec ? ` · ${formatDuration(activeVideo.durationSec)}` : ''}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Playlist */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Dans cette playlist</p>
              </div>
              <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                {sorted.map((pv, idx) => {
                  const active = pv.video.id === activeVideoId
                  return (
                    <button
                      key={pv.video.id}
                      onClick={() => setActiveVideoId(pv.video.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        active ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-5 text-center text-xs font-medium flex-shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {active ? '▶' : idx + 1}
                      </span>
                      <div className="w-12 h-9 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                        {pv.video.thumbnailUrl
                          ? <img src={pv.video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-sm">🎥</div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? 'text-indigo-700' : 'text-gray-900'}`}>
                          {pv.video.title}
                        </p>
                        {pv.video.durationSec && (
                          <p className="text-xs text-gray-400">{formatDuration(pv.video.durationSec)}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
