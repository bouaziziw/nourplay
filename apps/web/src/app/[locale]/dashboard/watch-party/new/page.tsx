'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, WatchPartyCreated } from '../../../../../lib/api'

interface Playlist { id: string; name: string; _count: { playlistVideos: number } }

export default function NewWatchPartyPage() {
  const locale = useLocale()
  const { token, loading } = useAuth()
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [party, setParty] = useState<WatchPartyCreated | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) return
    api.playlists.list(token).then(setPlaylists).catch(() => {})
  }, [token])

  const handleCreate = async () => {
    if (!token || !selectedId) return
    setCreating(true)
    setError('')
    try {
      const result = await api.watchParties.create(token, selectedId)
      setParty(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = () => {
    if (!party) return
    navigator.clipboard.writeText(party.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <Link href={`/${locale}/dashboard`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Tableau de bord
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Nouveau co-visionnage</h1>
        <p className="text-sm text-gray-500 mt-1">
          Regardez une playlist en temps réel avec d&apos;autres personnes.
        </p>
      </div>

      {!party ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choisir une playlist
            </label>
            {playlists.length === 0 ? (
              <p className="text-sm text-gray-400">
                Aucune playlist.{' '}
                <Link href={`/${locale}/dashboard/playlists/new`} className="text-indigo-600 hover:underline">
                  Créer une playlist
                </Link>
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {playlists.map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => setSelectedId(pl.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedId === pl.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900 truncate">{pl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={!selectedId || creating}
            className="w-full h-10 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Création…' : 'Démarrer la salle'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Salle créée !</h2>
            <p className="text-sm text-gray-500 mt-1">
              Partagez ce code avec les participants.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <span className="flex-1 text-3xl font-mono font-bold tracking-[0.3em] text-center text-indigo-600">
              {party.code}
            </span>
            <button
              onClick={copyCode}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Copier le code"
            >
              {copied ? (
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            La salle expire dans 24 heures.
          </p>

          <Link
            href={`/${locale}/dashboard/watch-party/${party.code}`}
            className="flex items-center justify-center w-full h-10 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Entrer dans la salle
          </Link>
        </div>
      )}
    </div>
  )
}
