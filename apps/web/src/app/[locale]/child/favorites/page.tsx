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
        <div className="animate-spin h-8 w-8 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-white text-black">
      <h1 className="text-2xl sm:text-3xl font-black text-black">Mes favoris ❤️</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16 bg-white/80 rounded-3xl border border-black/10 max-w-md mx-auto shadow-sm">
          <p className="text-5xl mb-4">💝</p>
          <p className="text-black font-bold">Aucun favori pour l&apos;instant.</p>
          <p className="text-sm text-black/70 mt-1">
            Ajoute des vidéos depuis tes playlists !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {favorites.map(fav => (
            <div key={fav.id} className="group relative bg-white/80 rounded-2xl border border-black/10 p-3 shadow-md hover:border-[#1c90d8] transition-all">
              <button
                onClick={() => router.push(`/${locale}/child/watch/${fav.videoId}`)}
                className="w-full text-left"
              >
                <div className="relative bg-slate-100 rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
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
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-bold">
                      {formatDuration(fav.video.durationSec)}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
                      <span className="text-black font-black ml-0.5">▶</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold text-black line-clamp-2 mt-2 leading-snug px-0.5 group-hover:text-[#1c90d8] transition-colors">
                  {fav.video.title}
                </p>
              </button>

              <button
                onClick={() => handleRemove(fav.videoId)}
                disabled={removing === fav.videoId}
                title="Retirer des favoris"
                className="mt-2 text-xs font-bold text-black/60 hover:text-red-500 py-1 px-2.5 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
              >
                {removing === fav.videoId ? 'Suppression…' : '❤️ Retirer'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
