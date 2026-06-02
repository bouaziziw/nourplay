'use client'

import { useEffect, useState } from 'react'
import { api, ProfileSummary } from '../lib/api'

interface Props {
  videoId: string
  videoTitle: string
  token: string
  onClose: () => void
}

export function AddToFavoritesModal({ videoId, videoTitle, token, onClose }: Props) {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.users.profiles(token)
      .then(setProfiles)
      .catch(() => setError('Impossible de charger les profils.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleAdd = async (profileId: string) => {
    setAdding(profileId)
    setError('')
    try {
      await api.favorites.add(token, profileId, videoId)
      setAdded(profileId)
      setTimeout(onClose, 1200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout.')
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">Ajouter aux favoris d'un profil</h2>
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
        ) : profiles.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucun profil enfant créé.</p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {profiles.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => handleAdd(p.id)}
                  disabled={!!adding || added === p.id}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    added === p.id
                      ? 'bg-pink-50 text-pink-700 border border-pink-200'
                      : 'hover:bg-indigo-50 hover:text-indigo-700 border border-transparent'
                  } disabled:cursor-not-allowed`}
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                    {p.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-medium truncate flex-1 text-left">{p.displayName}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {added === p.id ? '♥ Ajouté' : adding === p.id ? '…' : p.ageGroup.replace('AGE_', '').replace('_', '–') + ' ans'}
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
