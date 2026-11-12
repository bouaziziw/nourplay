'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { useChildSession } from '../../../../../hooks/useChildSession'
import { VideoPlayer } from '../../../../../components/VideoPlayer'
import { RemoteImage } from '../../../../../components/RemoteImage'
import { api, PlaylistDetail, VideoSummary, VideoSearchResult } from '../../../../../lib/api'

const AGE_RATING_ORDER = ['ALL', 'AGE_4_PLUS', 'AGE_7_PLUS', 'AGE_10_PLUS', 'AGE_13_PLUS']
const PLAYLIST_VIDEOS_PER_PAGE = 12
const AGE_GROUP_MAX: Record<string, string> = {
  AGE_0_3: 'ALL', AGE_4_6: 'AGE_4_PLUS', AGE_7_9: 'AGE_7_PLUS',
  AGE_10_12: 'AGE_10_PLUS', AGE_13_15: 'AGE_13_PLUS',
}
function isAgeAllowed(ageRating: string, ageGroup: string): boolean {
  const maxIdx = AGE_RATING_ORDER.indexOf(AGE_GROUP_MAX[ageGroup] ?? 'AGE_13_PLUS')
  const ratingIdx = AGE_RATING_ORDER.indexOf(ageRating)
  return ratingIdx >= 0 && maxIdx >= 0 && ratingIdx <= maxIdx
}

export default function ChildWatchPage() {
  const { videoId } = useParams<{ videoId: string }>()
  const searchParams = useSearchParams()
  const playlistId = searchParams.get('playlist') ?? ''
  const locale = useLocale()
  const router = useRouter()
  const { token } = useAuth()
  const { session } = useChildSession()
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null)
  const [directVideo, setDirectVideo] = useState<VideoSearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [similarVideos, setSimilarVideos] = useState<VideoSummary[]>([])
  const [myRating, setMyRating] = useState<'THUMBS_UP' | 'THUMBS_DOWN' | null>(null)
  const [ccEnabled, setCcEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nourplay:cc') === '1'
  })
  const [readingMode, setReadingMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('nourplay:reading') === '1'
  })
  const [savedPosition, setSavedPosition] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [showResume, setShowResume] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<'PENDING' | 'APPROVED' | 'DENIED' | null | 'unchecked'>('unchecked')
  const [requestingApproval, setRequestingApproval] = useState(false)
  const [playlistPage, setPlaylistPage] = useState(1)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    if (playlistId) {
      api.playlists.getById(token, playlistId)
        .then(setPlaylist)
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      api.videos.getById(token, videoId)
        .then(setDirectVideo)
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [token, playlistId, videoId])

  useEffect(() => {
    if (!token || !videoId) return
    api.videos.getSimilar(token, videoId)
      .then(setSimilarVideos)
      .catch(() => {})
  }, [token, videoId])

  // Check parental approval if video is age-restricted for this profile
  useEffect(() => {
    if (!token || !session?.profileId || !directVideo) return
    if (isAgeAllowed(directVideo.ageRating ?? 'ALL', session.ageGroup)) {
      setApprovalStatus(null) // not needed
      return
    }
    api.approvals.getStatus(token, session.profileId, directVideo.id)
      .then(({ status }) => setApprovalStatus(status))
      .catch(() => setApprovalStatus(null))
  }, [token, session?.profileId, session?.ageGroup, directVideo])

  // Fetch saved rating
  useEffect(() => {
    if (!token || !session?.profileId || !videoId) return
    api.users.getVideoRating(token, session.profileId, videoId)
      .then(({ rating }) => setMyRating(rating))
      .catch(() => {})
  }, [token, session?.profileId, videoId])

  // Fetch saved progress — show resume banner if ≥ 10s and not completed
  useEffect(() => {
    if (!token || !session?.profileId || !videoId) return
    api.users.getProgress(token, session.profileId, videoId)
      .then(({ positionSec, completed }) => {
        if (positionSec >= 10 && !completed) {
          setSavedPosition(positionSec)
          setShowResume(true)
        }
      })
      .catch(() => {})
  }, [token, session?.profileId, videoId])

  const handleWatched = (durationSec: number, completed: boolean) => {
    if (!token || !session?.profileId) return
    api.users.recordWatch(token, session.profileId, {
      videoId,
      durationWatchedSec: durationSec,
      completed,
    }).catch(() => {})
  }

  const handleCCToggle = () => {
    setCcEnabled(prev => {
      const next = !prev
      localStorage.setItem('nourplay:cc', next ? '1' : '0')
      return next
    })
  }

  const handleReadingModeToggle = () => {
    setReadingMode(prev => {
      const next = !prev
      localStorage.setItem('nourplay:reading', next ? '1' : '0')
      return next
    })
  }

  const handleRate = (r: 'THUMBS_UP' | 'THUMBS_DOWN') => {
    if (!token || !session?.profileId) return
    const prev = myRating
    const next = myRating === r ? null : r
    setMyRating(next)
    api.users.rateVideo(token, session.profileId, videoId, next).catch(() => setMyRating(prev))
  }

  const handleProgress = (positionSec: number) => {
    if (!token || !session?.profileId) return
    api.users.saveProgress(token, session.profileId, videoId, positionSec).catch(() => {})
  }

  const handleRequestApproval = async () => {
    if (!token || !session?.profileId) return
    setRequestingApproval(true)
    try {
      await api.approvals.request(token, session.profileId, videoId)
      setApprovalStatus('PENDING')
    } catch { /* ignore */ } finally {
      setRequestingApproval(false)
    }
  }

  const playlistVideo = playlist?.playlistVideos.find(pv => pv.video.id === videoId)?.video
  const video = playlistVideo ?? directVideo
  const supportsCC = !!(video && (video.embedUrl.includes('youtube.com') || video.embedUrl.includes('youtu.be') || video.embedUrl.includes('dailymotion.com')))
  const needsApproval = session && video && !isAgeAllowed(video.ageRating ?? 'ALL', session.ageGroup) && approvalStatus !== 'APPROVED'
  const currentIndex = playlist?.playlistVideos.findIndex(pv => pv.video.id === videoId) ?? -1
  const sortedVideos = playlist
    ? [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
    : []
  const currentSortedIndex = sortedVideos.findIndex(pv => pv.video.id === videoId)
  const nextVideo = sortedVideos[currentSortedIndex + 1]?.video ?? null
  const playlistPageCount = Math.ceil(sortedVideos.length / PLAYLIST_VIDEOS_PER_PAGE)
  const visiblePlaylistVideos = sortedVideos.slice(
    (playlistPage - 1) * PLAYLIST_VIDEOS_PER_PAGE,
    playlistPage * PLAYLIST_VIDEOS_PER_PAGE,
  )

  useEffect(() => {
    if (currentSortedIndex >= 0) {
      setPlaylistPage(Math.floor(currentSortedIndex / PLAYLIST_VIDEOS_PER_PAGE) + 1)
    }
  }, [currentSortedIndex, videoId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🎬</p>
        <p className="text-gray-500 mb-4">Vidéo introuvable.</p>
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:underline text-sm"
        >
          ← Retour
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {playlistId ? 'Retour à la playlist' : 'Retour'}
      </button>

      {/* Resume banner */}
      {showResume && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-indigo-700 font-medium">
              Reprendre à {Math.floor(savedPosition / 60)}:{String(savedPosition % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStartAt(savedPosition); setShowResume(false) }}
              className="h-7 px-3 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Reprendre
            </button>
            <button
              onClick={() => { setStartAt(0); setShowResume(false) }}
              className="h-7 px-3 text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg transition-colors"
            >
              Recommencer
            </button>
          </div>
        </div>
      )}

      {/* Player or approval gate */}
      {needsApproval ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Autorisation parentale requise</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ce contenu est classé <strong>{video?.ageRating}</strong> et nécessite l&apos;accord d&apos;un parent.
            </p>
          </div>
          {approvalStatus === 'PENDING' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-medium">
              Demande envoyée — en attente de l&apos;accord d&apos;un parent
            </div>
          ) : approvalStatus === 'DENIED' ? (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                Un parent a refusé cette demande.
              </div>
              <button
                onClick={handleRequestApproval}
                disabled={requestingApproval}
                className="h-10 px-6 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {requestingApproval ? 'Envoi…' : 'Redemander l\'autorisation'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRequestApproval}
              disabled={requestingApproval}
              className="h-10 px-6 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {requestingApproval ? 'Envoi en cours…' : 'Demander l\'autorisation'}
            </button>
          )}
        </div>
      ) : (
        <VideoPlayer
          key={`${videoId}-${startAt}-${ccEnabled}`}
          embedUrl={video.embedUrl}
          title={video.title}
          startAt={startAt}
          ccEnabled={ccEnabled}
          onWatched={handleWatched}
          onProgress={handleProgress}
        />
      )}

      {/* Player controls row */}
      {!needsApproval && (
        <div className="flex items-center gap-2 px-1">
          {/* CC toggle */}
          <button
            onClick={handleCCToggle}
            disabled={!supportsCC}
            title={
              !supportsCC ? 'Sous-titres non disponibles pour cette source'
              : ccEnabled ? 'Désactiver les sous-titres'
              : 'Activer les sous-titres'
            }
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold transition-all ${
              !supportsCC
                ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400'
                : ccEnabled
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            CC
          </button>
          {/* Reading mode toggle */}
          <button
            onClick={handleReadingModeToggle}
            title={readingMode ? 'Quitter le mode lecture' : 'Mode lecture — afficher la description'}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all ${
              readingMode
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-gray-500 border-gray-200 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Lecture
          </button>
        </div>
      )}

      {/* Video title + reading mode description */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
        <h1 className="font-bold text-gray-900 text-lg leading-snug">{video.title}</h1>
        {playlist && (
          <p className="text-sm text-gray-500 mt-1">
            {playlist.name}
            {currentSortedIndex >= 0 && (
              <span className="ml-2 text-xs text-gray-400">
                · #{sortedVideos[currentSortedIndex]?.position}
              </span>
            )}
          </p>
        )}
        {Boolean(readingMode && ('description' in video) && video.description) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Mode lecture
            </p>
            <p className="text-base leading-relaxed text-gray-700 whitespace-pre-line">{String(('description' in video) && video.description)}</p>
          </div>
        )}
      </div>

      {sortedVideos.length > 1 && playlistId && (
        <section className="rounded-2xl bg-white/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Vidéos de la playlist
            </h2>
            <span className="text-xs text-gray-400">
              {currentSortedIndex + 1} / {sortedVideos.length}
            </span>
          </div>
          <div
            aria-label="Choisir une vidéo de la playlist"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {visiblePlaylistVideos.map(({ video: playlistItem, position }) => (
              <button
                key={playlistItem.id}
                type="button"
                aria-current={playlistItem.id === videoId ? 'true' : undefined}
                onClick={() => router.push(`/${locale}/child/watch/${playlistItem.id}?playlist=${playlistId}`)}
                className={`overflow-hidden rounded-xl border text-left transition-colors ${
                  playlistItem.id === videoId
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                    : 'border-gray-100 bg-white hover:border-indigo-200'
                }`}
              >
                <div className="relative aspect-video bg-gray-100">
                  {playlistItem.thumbnailUrl ? (
                    <RemoteImage
                      src={playlistItem.thumbnailUrl}
                      alt=""
                      fill
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {position}
                  </span>
                </div>
                <span className="block p-2 text-xs font-medium leading-snug text-gray-800 line-clamp-2">
                  {playlistItem.title}
                </span>
              </button>
            ))}
          </div>
          {playlistPageCount > 1 && (
            <nav aria-label="Pagination des vidéos" className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPlaylistPage(current => Math.max(1, current - 1))}
                disabled={playlistPage === 1}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-500">Page {playlistPage} sur {playlistPageCount}</span>
              <button
                type="button"
                onClick={() => setPlaylistPage(current => Math.min(playlistPageCount, current + 1))}
                disabled={playlistPage === playlistPageCount}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Suivant
              </button>
            </nav>
          )}
        </section>
      )}

      {/* Rating */}
      {session?.profileId && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm flex items-center justify-center gap-3">
          <span className="text-sm text-gray-500">Tu as aimé ?</span>
          <button
            onClick={() => handleRate('THUMBS_UP')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              myRating === 'THUMBS_UP'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
            </svg>
            J&apos;aime
          </button>
          <button
            onClick={() => handleRate('THUMBS_DOWN')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              myRating === 'THUMBS_DOWN'
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
            </svg>
            Pas pour moi
          </button>
        </div>
      )}

      {/* Similar videos */}
      {similarVideos.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">Vous pourriez aimer</p>
          <div className="grid grid-cols-2 gap-3">
            {similarVideos.map(sv => (
              <button
                key={sv.id}
                onClick={() => router.push(`/${locale}/child/watch/${sv.id}${playlistId ? `?playlist=${playlistId}` : ''}`)}
                className="text-left group"
              >
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-1.5" style={{ paddingBottom: '56.25%' }}>
                  {sv.thumbnailUrl ? (
                    <RemoteImage src={sv.thumbnailUrl} alt={sv.title} fill className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                  {sv.title}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next video */}
      {nextVideo && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3 font-medium">Suivant</p>
          <button
            onClick={() => router.push(`/${locale}/child/watch/${nextVideo.id}?playlist=${playlistId}`)}
            className="w-full flex items-center gap-3 text-left group"
          >
            <div className="w-24 flex-shrink-0 relative bg-gray-100 rounded-lg overflow-hidden" style={{ paddingBottom: '42%' }}>
              {nextVideo.thumbnailUrl ? (
                <RemoteImage
                  src={nextVideo.thumbnailUrl}
                  alt={nextVideo.title}
                  fill
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🎥</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                {nextVideo.title}
              </p>
            </div>
            <svg className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
