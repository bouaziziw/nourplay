'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, PlaylistSummary } from '../../../../lib/api'
import {
  PLAYLIST_CATEGORIES,
  LANGUAGE_OPTIONS,
  unpackPlaylistDescription,
  getCategoryBadge,
  getLanguageBadge,
} from '../../../../lib/playlistCategory'

const AGE_OPTIONS = [
  { value: 'ALL', label: 'Tous les âges' },
  { value: 'AGE_0_3', label: '0–3 ans' },
  { value: 'AGE_4_6', label: '4–6 ans' },
  { value: 'AGE_7_9', label: '7–9 ans' },
  { value: 'AGE_10_12', label: '10–12 ans' },
  { value: 'AGE_13_15', label: '13–15 ans' },
]

const VISIBILITY_OPTIONS = [
  { value: 'ALL', label: 'Toutes visibilités' },
  { value: 'PRIVATE', label: '🔒 Privée' },
  { value: 'SHARED_USERS', label: '👥 Partagée' },
  { value: 'SHARED_LINK', label: '🔗 Lien public' },
]

export default function PlaylistsPage() {
  const locale = useLocale()
  const { token, loading: authLoading } = useAuth()
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filtres multicritères
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedAge, setSelectedAge] = useState('ALL')
  const [selectedLanguage, setSelectedLanguage] = useState('ALL')
  const [selectedVisibility, setSelectedVisibility] = useState('ALL')

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
    if (!token || !window.confirm(`Supprimer définitivement la playlist « ${name} » ? Cette action est irréversible.`)) return
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

  // Filtrage multicritère en mémoire
  const filteredPlaylists = useMemo(() => {
    return playlists.filter(playlist => {
      const { category, cleanDescription } = unpackPlaylistDescription(
        playlist.description,
        playlist.name
      )

      // 1. Recherche texte (nom ou description)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        const matchName = playlist.name.toLowerCase().includes(query)
        const matchDesc = cleanDescription.toLowerCase().includes(query)
        if (!matchName && !matchDesc) return false
      }

      // 2. Filtre par Catégorie
      if (selectedCategory !== 'ALL') {
        if (category !== selectedCategory) return false
      }

      // 3. Filtre par Âge
      if (selectedAge !== 'ALL') {
        const ages = playlist.targetAgeGroup ?? []
        if (!ages.includes(selectedAge)) return false
      }

      // 4. Filtre par Langue
      if (selectedLanguage !== 'ALL') {
        const langs = (playlist.languages ?? []).map(l => l.toLowerCase())
        if (!langs.includes(selectedLanguage.toLowerCase())) return false
      }

      // 5. Filtre par Visibilité
      if (selectedVisibility !== 'ALL') {
        if (playlist.visibility !== selectedVisibility) return false
      }

      return true
    })
  }, [playlists, searchQuery, selectedCategory, selectedAge, selectedLanguage, selectedVisibility])

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedAge !== 'ALL' ||
    selectedLanguage !== 'ALL' ||
    selectedVisibility !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('ALL')
    setSelectedAge('ALL')
    setSelectedLanguage('ALL')
    setSelectedVisibility('ALL')
  }

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
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes playlists</h1>
          <p className="mt-1 text-sm text-gray-500">
            Créez, modifiez et gérez les univers vidéo de vos enfants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/child`}
            className="inline-flex h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 transition-colors shadow-sm"
          >
            Mode enfant 🎈
          </Link>
          <Link
            href={`/${locale}/dashboard/playlists/new`}
            className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shadow-sm"
          >
            + Nouvelle playlist
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Barre de filtres multicritères */}
      {playlists.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 space-y-3.5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* 1. Recherche par texte */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, mot-clé, thème..."
                className="w-full h-10 pl-9 pr-8 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-sm p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 2. Filtres Selects */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              {/* Catégorie */}
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="h-10 px-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">⭐ Toutes catégories</option>
                {PLAYLIST_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>

              {/* Âge */}
              <select
                value={selectedAge}
                onChange={e => setSelectedAge(e.target.value)}
                className="h-10 px-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {AGE_OPTIONS.map(age => (
                  <option key={age.value} value={age.value}>
                    {age.label}
                  </option>
                ))}
              </select>

              {/* Langue */}
              <select
                value={selectedLanguage}
                onChange={e => setSelectedLanguage(e.target.value)}
                className="h-10 px-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="ALL">🌐 Toutes langues</option>
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>

              {/* Visibilité */}
              <select
                value={selectedVisibility}
                onChange={e => setSelectedVisibility(e.target.value)}
                className="h-10 px-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {VISIBILITY_OPTIONS.map(vis => (
                  <option key={vis.value} value={vis.value}>
                    {vis.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ligne d'état des filtres */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
            <span>
              Affichage de <strong className="text-gray-900">{filteredPlaylists.length}</strong> playlist{filteredPlaylists.length !== 1 ? 's' : ''} sur {playlists.length}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>
      )}

      {/* État vide si aucune playlist au départ */}
      {!error && playlists.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 text-2xl">
            🎬
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Aucune playlist pour le moment</h2>
          <p className="mt-2 text-sm text-gray-500">Créez votre première playlist pour organiser les vidéos adaptées à vos enfants.</p>
          <Link
            href={`/${locale}/dashboard/playlists/new`}
            className="mt-5 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Créer ma première playlist
          </Link>
        </div>
      )}

      {/* État aucun résultat après filtrage */}
      {playlists.length > 0 && filteredPlaylists.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-3xl mb-2">🔍</p>
          <h3 className="text-base font-semibold text-gray-800">Aucune playlist ne correspond à ces critères</h3>
          <p className="text-sm text-gray-500 mt-1">Essayez d&apos;élargir votre recherche ou de réinitialiser les filtres.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center h-9 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
          >
            Effacer tous les filtres
          </button>
        </div>
      )}

      {/* Grille des playlists */}
      {filteredPlaylists.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlaylists.map(playlist => {
            const { category, cleanDescription } = unpackPlaylistDescription(
              playlist.description,
              playlist.name
            )
            const catBadge = getCategoryBadge(category)
            const langBadge = playlist.languages?.[0] ? getLanguageBadge(playlist.languages[0]) : null

            return (
              <article
                key={playlist.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md hover:border-gray-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <span>{catBadge.emoji}</span>
                      <span>{catBadge.label}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {playlist._count.playlistVideos} vidéo{playlist._count.playlistVideos === 1 ? '' : 's'}
                    </span>
                  </div>

                  <Link
                    href={`/${locale}/dashboard/playlists/${playlist.id}`}
                    className="block group"
                  >
                    <h2 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 text-base">
                      {playlist.name}
                    </h2>
                    {cleanDescription ? (
                      <p className="mt-1.5 line-clamp-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                        {cleanDescription}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-gray-400 italic">Aucune description</p>
                    )}
                  </Link>

                  <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    {langBadge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100">
                        <span>{langBadge.flag}</span>
                        <span>{langBadge.label}</span>
                      </span>
                    )}
                    <span className="capitalize px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100">
                      {playlist.visibility.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Actions Parents : Modifier & Supprimer */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/${locale}/dashboard/playlists/${playlist.id}`}
                      className="text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-colors"
                    >
                      Ouvrir →
                    </Link>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/${locale}/dashboard/playlists/${playlist.id}/edit`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifier
                    </Link>
                    <button
                      type="button"
                      onClick={() => deletePlaylist(playlist.id, playlist.name)}
                      disabled={deletingId === playlist.id}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {deletingId === playlist.id ? 'Suppression…' : 'Supprimer'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
