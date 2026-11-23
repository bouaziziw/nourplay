'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { useChildSession } from '../../../../../hooks/useChildSession'
import { useOfflinePlaylists, readOfflinePlaylist } from '../../../../../hooks/useOfflinePlaylists'
import { api, PlaylistDetail } from '../../../../../lib/api'
import { RemoteImage } from '../../../../../components/RemoteImage'
import { getPlaylistTheme } from '../../../../../lib/channelTheme'
import { unpackPlaylistDescription } from '../../../../../lib/playlistCategory'
import { isTvDevice } from '../../../../../hooks/useTvNavigation'

const VIDEOS_PER_PAGE = 12

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  return m > 0 ? `${m}m` : `${sec}s`
}

function offlineToPlaylistDetail(p: ReturnType<typeof readOfflinePlaylist>): PlaylistDetail | null {
  if (!p) return null
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    visibility: 'PRIVATE',
    targetAgeGroup: [],
    languages: [],
    scheduledPublishAt: null,
    createdAt: p.savedAt,
    playlistVideos: p.videos.map((v, i) => ({
      id: `${p.id}-${v.id}`,
      position: i + 1,
      video: v,
    })),
  }
}

export default function ChildPlaylistPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const { session } = useChildSession()
  const { saved, save, remove } = useOfflinePlaylists()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOfflineFallback, setIsOfflineFallback] = useState(false)
  const [visibleCount, setVisibleCount] = useState(VIDEOS_PER_PAGE)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const isSaved = saved.some(p => p.id === id)

  useEffect(() => {
    if (!token) return
    api.playlists.getById(token, id, session?.profileId)
      .then(p => { setPlaylist(p); setIsOfflineFallback(false) })
      .catch(() => {
        const offline = offlineToPlaylistDetail(readOfflinePlaylist(id))
        if (offline) {
          setPlaylist(offline)
          setIsOfflineFallback(true)
        } else {
          router.replace(`/${locale}/child/playlists`)
        }
      })
      .finally(() => setLoading(false))
  }, [token, id, locale, router, session?.profileId])

  const handleToggleSave = async () => {
    if (!playlist) return
    setSaving(true)
    try {
      if (isSaved) {
        await remove(id)
      } else {
        await save(playlist)
      }
    } finally {
      setSaving(false)
    }
  }

  const videos = playlist ? playlist.playlistVideos.sort((a, b) => a.position - b.position) : []
  const hasMore = visibleCount < videos.length
  const visibleVideos = videos.slice(0, visibleCount)

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          setLoadingMore(true)
          setTimeout(() => {
            setVisibleCount(prev => Math.min(prev + VIDEOS_PER_PAGE, videos.length))
            setLoadingMore(false)
          }, 150)
        }
      },
      { rootMargin: '250px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, videos.length])

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent shadow-lg" />
        <p className="text-base font-bold text-sky-800 animate-pulse">
          Ouverture de la chaîne... 🎈
        </p>
      </div>
    )
  }

  if (!playlist) return null

  const theme = getPlaylistTheme(playlist.name, playlist.description)
  const { cleanDescription } = unpackPlaylistDescription(playlist.description, playlist.name)
  const firstVideo = videos[0]?.video

  return (
    <div className="space-y-6 pb-12">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/${locale}/child/playlists`)}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-sm font-extrabold text-gray-700 shadow-sm transition hover:bg-white hover:text-sky-700 hover:shadow-md"
        >
          <svg className="w-5 h-5 text-[#1c90d8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Toutes les chaînes</span>
        </button>

        <div className="flex items-center gap-2">
          {!isTvDevice() && !isOfflineFallback && (
            <Link
              href={`/${locale}/dashboard/playlists/${id}/edit`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-extrabold text-gray-700 bg-white/90 hover:bg-white hover:text-indigo-600 border border-gray-200 transition-all shadow-sm"
              title="Modifier ou supprimer cette playlist dans l'espace parent"
            >
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Gérer / Modifier</span>
            </Link>
          )}

          {!isOfflineFallback && (
            <button
              onClick={handleToggleSave}
              disabled={saving}
              title={isSaved ? "Supprimer de l'accès hors ligne" : 'Enregistrer hors ligne'}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all shadow-sm ${
                saving
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                  : isSaved
                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  : 'bg-white/90 text-gray-700 hover:bg-white border border-gray-200'
              }`}
            >
              {saving ? (
                <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : isSaved ? (
                <>
                  <span>💾</span>
                  <span>Enregistré hors-ligne</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span>Enregistrer hors-ligne</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Hero Channel Showcase Banner */}
      <section
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-md text-4xl sm:text-5xl shadow-inner border border-white/30">
              {theme.emoji}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                <span>{theme.illustration}</span>
                <span>{theme.channelLabel}</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight drop-shadow-sm">
                {playlist.name}
              </h1>
              {cleanDescription && (
                <p className="mt-1.5 text-sm sm:text-base font-medium text-white/90 max-w-2xl leading-relaxed">
                  {cleanDescription}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs font-bold text-white/90">
                <span className="rounded-lg bg-black/20 px-2.5 py-1">
                  🎬 {videos.length} épisode{videos.length !== 1 ? 's' : ''}
                </span>
                {session?.displayName && (
                  <span className="rounded-lg bg-black/20 px-2.5 py-1">
                    👶 Pour {session.displayName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action: Play All Button */}
          {firstVideo && (
            <div className="shrink-0">
              <Link
                href={`/${locale}/child/watch/${firstVideo.id}?playlist=${id}`}
                className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-black text-gray-900 shadow-2xl transition hover:scale-105 active:scale-95"
                style={{ color: theme.accentColor }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md text-lg" style={{ backgroundColor: theme.accentColor }}>
                  ▶
                </span>
                <span>Tout regarder</span>
              </Link>
            </div>
          )}
        </div>

        {/* Decorative background lights */}
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-10 h-36 w-36 rounded-full bg-black/10 blur-xl pointer-events-none" />
      </section>

      {/* Offline fallback notice */}
      {isOfflineFallback && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm font-semibold text-amber-800 shadow-sm">
          <span className="text-xl">✈️</span>
          <span>Mode hors ligne actif — les vidéos nécessitent une connexion pour la lecture en streaming.</span>
        </div>
      )}

      {/* Videos Grid */}
      {videos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white/70 p-16 text-center shadow-sm">
          <span className="text-6xl">🎬</span>
          <h3 className="mt-4 text-xl font-extrabold text-gray-800">Aucune vidéo dans cette chaîne</h3>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {"Reviens bientôt ou demande à ton parent d'ajouter des épisodes."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pt-2">
            <h2 className="text-xl font-extrabold text-gray-900">
              Tous les épisodes 🍿
            </h2>
            <span className="text-xs font-bold text-gray-500">
              {visibleVideos.length} sur {videos.length}
            </span>
          </div>

          <div
            aria-label="Vidéos de la chaîne"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {visibleVideos.map(({ video, position }) => (
              <Link
                key={video.id}
                href={`/${locale}/child/watch/${video.id}?playlist=${id}`}
                className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl border border-gray-100 focus:outline-none focus:ring-4 focus:ring-sky-400 focus:scale-[1.03] focus:shadow-2xl"
              >
                {/* 16:9 Thumbnail */}
                <div
                  className="relative w-full overflow-hidden bg-gray-100"
                  style={{ aspectRatio: '16/9' }}
                >
                  {video.thumbnailUrl ? (
                    <RemoteImage
                      src={video.thumbnailUrl}
                      alt={video.title}
                      fill
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-4xl"
                      style={{
                        background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
                      }}
                    >
                      <span className="text-white drop-shadow">{theme.emoji}</span>
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus:opacity-100">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#1c90d8] shadow-2xl transition-transform group-hover:scale-105">
                      <span className="ml-1 text-xl font-black">▶</span>
                    </div>
                  </div>

                  {/* Episode Position Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-black text-gray-900 shadow">
                    <span>#{position}</span>
                  </div>

                  {/* Duration Badge */}
                  {video.durationSec && (
                    <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
                      {formatDuration(video.durationSec)}
                    </div>
                  )}
                </div>

                {/* Video Info */}
                <div className="flex flex-1 flex-col justify-between p-4">
                  <h3 className="text-sm font-bold leading-snug text-gray-900 line-clamp-2 group-hover:text-[#1c90d8] transition-colors">
                    {video.title}
                  </h3>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
                    <span className="text-xs font-bold text-sky-600">
                      Regarder ›
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[#1c90d8] text-xs font-bold group-hover:bg-[#1c90d8] group-hover:text-white transition">
                      ▶
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          <div ref={sentinelRef} className="py-8 flex flex-col items-center justify-center gap-2">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm font-bold text-[#1c90d8]">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1c90d8] border-t-transparent" />
                <span>Chargement des vidéos suivantes…</span>
              </div>
            )}
            {!hasMore && videos.length > VIDEOS_PER_PAGE && (
              <span className="text-xs font-bold text-gray-400">
                🎉 Tous les épisodes sont affichés !
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
