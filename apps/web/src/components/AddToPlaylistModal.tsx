'use client'

import { useEffect, useState } from 'react'
import { api, PlaylistSummary } from '../lib/api'

interface Props {
  videoId: string
  videoTitle: string
  token: string
  onClose: () => void
}

export function AddToPlaylistModal({ videoId, videoTitle, token, onClose }: Props) {
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.playlists.list(token)
      .then(setPlaylists)
      .catch(() => setError('Impossible de charger les playlists.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAdd = async (playlistId: string) => {
    setAdding(playlistId)
    setError('')
    try {
      await api.playlists.addVideo(token, playlistId, videoId)
      setAdded(playlistId)
      setTimeout(onClose, 1200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout.')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Ajouter à une playlist</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{videoTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune playlist. Créez-en une d'abord.</p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {playlists.map(pl => (
              <li key={pl.id}>
                <button
                  onClick={() => handleAdd(pl.id)}
                  disabled={!!adding || added === pl.id}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    added === pl.id
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'hover:bg-indigo-50 hover:text-indigo-700 border border-transparent'
                  } disabled:cursor-not-allowed`}
                >
                  <span className="font-medium truncate">{pl.name}</span>
                  <span className="text-xs text-gray-400 ml-2 shrink-0">
                    {added === pl.id
                      ? '✓ Ajouté'
                      : adding === pl.id
                      ? '…'
                      : `${pl._count.playlistVideos} vidéo${pl._count.playlistVideos !== 1 ? 's' : ''}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
