'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { useChildSession } from '../../../../hooks/useChildSession'
import { api, VideoFavorite } from '../../../../lib/api'
import { RemoteImage } from '../../../../components/RemoteImage'

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

export default function ChildFavoritesPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const { session } = useChildSession()
  const [favorites, setFavorites] = useState<VideoFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !session?.profileId) return
    api.favorites.list(token, session.profileId)
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, session?.profileId])

  const handleRemove = async (videoId: string) => {
    if (!token || !session?.profileId || removing) return
    setRemoving(videoId)
    setFavorites(prev => prev.filter(f => f.videoId !== videoId))
    try {
      await api.favorites.remove(token, session.profileId, videoId)
    } catch {
      api.favorites.list(token, session.profileId).then(setFavorites).catch(() => {})
    } finally {
      setRemoving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mes favoris</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">💝</p>
          <p className="text-gray-500">Aucun favori pour l&apos;instant.</p>
          <p className="text-sm text-gray-400 mt-1">
            Ajoute des vidéos depuis tes playlists !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {favorites.map(fav => (
            <div key={fav.id} className="group relative">
              <button
                onClick={() => router.push(`/${locale}/child/watch/${fav.videoId}`)}
                className="w-full text-left"
              >
                <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                  {fav.video.thumbnailUrl ? (
                    <RemoteImage
                      src={fav.video.thumbnailUrl}
                      alt={fav.video.title}
                      fill
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl">🎥</span>
                    </div>
                  )}
                  {fav.video.durationSec && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(fav.video.durationSec)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2 mt-2 leading-snug px-0.5">
                  {fav.video.title}
                </p>
              </button>

              <button
                onClick={() => handleRemove(fav.videoId)}
                disabled={removing === fav.videoId}
                title="Retirer des favoris"
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 text-pink-500 hover:bg-pink-50 hover:text-pink-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
