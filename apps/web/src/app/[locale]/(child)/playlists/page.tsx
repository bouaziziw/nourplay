'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, PlaylistSummary } from '../../../../lib/api'

export default function ChildPlaylistsPage() {
  const locale = useLocale()
  const { token } = useAuth()
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api.playlists.list(token)
      .then(setPlaylists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mes playlists</h1>

      {playlists.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📚</p>
          <p className="text-gray-500">Aucune playlist disponible pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {playlists.map(pl => (
            <Link
              key={pl.id}
              href={`/${locale}/child/playlists/${pl.id}`}
              className="group bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center gap-4"
            >
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 truncate">{pl.name}</h2>
                {pl.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{pl.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
