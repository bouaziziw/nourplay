'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, PlaylistSummary } from '../../../../lib/api'

export default function PlaylistsPage() {
  const locale = useLocale()
  const { token, loading: authLoading } = useAuth()
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadPlaylists = useCallback(async () => {
    if (!token) return
    setError('')
    try {
      setPlaylists(await api.playlists.list(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les playlists.')
    } finally {
      setLoading(false)
    }
  }, [token])

  const deletePlaylist = async (id: string, name: string) => {
    if (!token || !window.confirm(`Supprimer la playlist « ${name} » ?`)) return
    setDeletingId(id)
    setError('')
    try {
      await api.playlists.delete(token, id)
      setPlaylists(items => items.filter(playlist => playlist.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette playlist.')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!authLoading) {
      if (token) {
        void loadPlaylists()
      } else {
        setLoading(false)
      }
    }
  }, [authLoading, loadPlaylists, token])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Vous devez être connecté.</p>
        <Link href={`/${locale}/auth/login`} className="text-indigo-600 font-medium hover:underline">
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes playlists</h1>
          <p className="mt-1 text-sm text-gray-500">Gérez vos playlists et leur contenu.</p>
        </div>
        <Link
          href={`/${locale}/dashboard/playlists/new`}
          className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Nouvelle playlist
        </Link>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && playlists.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-gray-900">Aucune playlist pour le moment</h2>
          <p className="mt-2 text-sm text-gray-500">Créez une playlist pour organiser les vidéos de votre famille.</p>
          <Link
            href={`/${locale}/dashboard/playlists/new`}
            className="mt-5 inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Créer ma première playlist
          </Link>
        </div>
      )}

      {playlists.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map(playlist => (
            <article key={playlist.id} className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
              <Link
                href={`/${locale}/dashboard/playlists/${playlist.id}`}
                className="block"
              >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-gray-900">{playlist.name}</h2>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                  {playlist._count.playlistVideos} vidéo{playlist._count.playlistVideos === 1 ? '' : 's'}
                </span>
              </div>
              {playlist.description && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">{playlist.description}</p>
              )}
              <p className="mt-4 text-xs capitalize text-gray-400">
                {playlist.visibility.toLowerCase().replace('_', ' ')}
              </p>
              </Link>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <Link
                  href={`/${locale}/dashboard/playlists/${playlist.id}/edit`}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Modifier
                </Link>
                <button
                  type="button"
                  onClick={() => deletePlaylist(playlist.id, playlist.name)}
                  disabled={deletingId === playlist.id}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === playlist.id ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
