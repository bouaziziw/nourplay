'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { useChildSession } from '../../../../../hooks/useChildSession'
import { VideoPlayer } from '../../../../../components/VideoPlayer'
import { RemoteImage } from '../../../../../components/RemoteImage'
import { api, PlaylistDetail, VideoSummary, VideoSearchResult } from '../../../../../lib/api'

const AGE_RATING_ORDER = ['ALL', 'AGE_4_PLUS', 'AGE_7_PLUS', 'AGE_10_PLUS', 'AGE_13_PLUS']
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
  const [playlistVisibleCount, setPlaylistVisibleCount] = useState(12)
  const [loadingMorePlaylist, setLoadingMorePlaylist] = useState(false)
  const playlistSentinelRef = useRef<HTMLDivElement | null>(null)

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

  const sortedVideos = playlist
    ? [...playlist.playlistVideos].sort((a, b) => a.position - b.position)
    : []
  const currentSortedIndex = sortedVideos.findIndex(pv => pv.video.id === videoId)
  const nextVideo = sortedVideos[currentSortedIndex + 1]?.video ?? (similarVideos[0] ?? null)
  const visiblePlaylistVideos = sortedVideos.slice(0, playlistVisibleCount)
  const hasMorePlaylist = playlistVisibleCount < sortedVideos.length

  useEffect(() => {
    if (currentSortedIndex >= 0) {
      setPlaylistVisibleCount(prev => Math.max(prev, currentSortedIndex + 6))
    }
  }, [currentSortedIndex, videoId])

  // Infinite scroll observer for playlist
  useEffect(() => {
    if (!playlistSentinelRef.current || !hasMorePlaylist) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMorePlaylist) {
          setLoadingMorePlaylist(true)
          setTimeout(() => {
            setPlaylistVisibleCount(prev => Math.min(prev + 12, sortedVideos.length))
            setLoadingMorePlaylist(false)
          }, 150)
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(playlistSentinelRef.current)
    return () => observer.disconnect()
  }, [hasMorePlaylist, sortedVideos.length])

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1c90d8] border-t-transparent shadow-lg" />
        <p className="text-base font-bold text-sky-800 animate-pulse">
          Préparation de ta vidéo... 🍿
        </p>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white/70 p-16 text-center shadow-sm max-w-xl mx-auto my-12">
        <p className="text-6xl mb-4">🎬</p>
        <h2 className="text-xl font-extrabold text-gray-900 mb-2">Vidéo introuvable</h2>
        <p className="text-sm font-medium text-gray-500 mb-6">
          Cette vidéo n'est plus accessible ou a été retirée.
        </p>
        <button
          onClick={() => router.push(`/${locale}/child/playlists`)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#1c90d8] px-6 py-3 text-sm font-extrabold text-white shadow-md hover:bg-[#1572ad]"
        >
          <span>Retour aux chaînes ⭐</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Top Friendly Back Link */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (playlistId) {
              router.push(`/${locale}/child/playlists/${playlistId}`)
            } else {
              router.push(`/${locale}/child/playlists`)
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-extrabold text-gray-700 shadow-sm transition hover:bg-white hover:text-sky-700 hover:shadow-md"
        >
          <svg className="w-5 h-5 text-[#1c90d8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span>{playlistId ? 'Retour à la chaîne' : 'Retour aux chaînes'}</span>
        </button>

        {playlist && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3.5 py-1 text-xs font-black text-sky-800">
            <span>📺</span>
            <span>{playlist.name}</span>
            {currentSortedIndex >= 0 && <span>(#{sortedVideos[currentSortedIndex]?.position})</span>}
          </span>
        )}
      </div>

      {/* Resume Banner */}
      {showResume && (
        <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-2xl px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⏱️</span>
            <span className="text-sm text-sky-900 font-bold">
              Reprendre à {Math.floor(savedPosition / 60)}:{String(savedPosition % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStartAt(savedPosition); setShowResume(false) }}
              className="h-8 px-4 bg-[#1c90d8] text-white text-xs font-extrabold rounded-xl hover:bg-[#1572ab] transition-all shadow-sm"
            >
              Reprendre ▶
            </button>
            <button
              onClick={() => { setStartAt(0); setShowResume(false) }}
              className="h-8 px-3 text-xs font-bold text-sky-700 hover:text-sky-900 bg-white border border-sky-200 rounded-xl transition-all"
            >
              Recommencer
            </button>
          </div>
        </div>
      )}

      {/* Video Player or Approval Gate */}
      <div className="relative overflow-hidden rounded-3xl bg-black shadow-2xl border border-white/20">
        {needsApproval ? (
          <div className="bg-white/95 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-3xl">
              🛡️
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Accord parental requis</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                Cette vidéo est réservée à la tranche <strong>{video?.ageRating}</strong>.
              </p>
            </div>
            {approvalStatus === 'PENDING' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800 font-bold">
                Demande envoyée à ton parent ! ⏳
              </div>
            ) : approvalStatus === 'DENIED' ? (
              <div className="space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm font-bold text-rose-700">
                  Un parent a refusé l'accès à ce contenu.
                </div>
                <button
                  onClick={handleRequestApproval}
                  disabled={requestingApproval}
                  className="h-10 px-6 bg-[#1c90d8] text-white text-sm font-bold rounded-2xl hover:bg-[#1572ab] transition"
                >
                  {requestingApproval ? 'Envoi…' : 'Redemander l\'accord'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequestApproval}
                disabled={requestingApproval}
                className="h-11 px-8 bg-[#1c90d8] text-white text-sm font-extrabold rounded-2xl hover:bg-[#1572ab] transition shadow-md"
              >
                {requestingApproval ? 'Demande en cours…' : 'Demander à mon parent 🙋'}
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
      </div>

      {/* Prominent Next Video Action Button */}
      {nextVideo && (
        <Link
          href={`/${locale}/child/watch/${nextVideo.id}${playlistId ? `?playlist=${playlistId}` : ''}`}
          className="group flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-5 text-white shadow-xl transition-all duration-200 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl sm:text-3xl backdrop-blur-md shadow-inner">
              ⏭️
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-100 backdrop-blur-sm">
                <span>Épisode suivant</span>
              </span>
              <p className="mt-0.5 text-base sm:text-lg font-extrabold truncate drop-shadow-sm">
                {nextVideo.title}
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-2xl bg-white px-5 py-3 text-xs sm:text-sm font-black text-emerald-800 shadow-lg group-hover:bg-emerald-50 transition">
            Regarder ▶
          </span>
        </Link>
      )}

      {/* Controls & Title Row */}
      <div className="rounded-3xl bg-white/90 p-5 shadow-sm backdrop-blur-md border border-white/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-snug">
              {video.title}
            </h1>
            {playlist && (
              <p className="mt-1 text-xs font-bold text-sky-600">
                📺 {playlist.name}
              </p>
            )}
          </div>

          {/* Kid Love Button */}
          {session?.profileId && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => handleRate('THUMBS_UP')}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-extrabold transition-all duration-200 shadow-sm ${
                  myRating === 'THUMBS_UP'
                    ? 'bg-pink-500 text-white shadow-pink-200 shadow-md scale-105'
                    : 'bg-pink-50 text-pink-600 hover:bg-pink-100'
                }`}
              >
                <span className="text-lg">❤️</span>
                <span>{myRating === 'THUMBS_UP' ? "J'adore !" : "J'aime"}</span>
              </button>
              <button
                onClick={() => handleRate('THUMBS_DOWN')}
                title="Je n'aime pas"
                className={`inline-flex items-center justify-center rounded-2xl h-10 w-10 text-sm font-extrabold transition-all duration-200 ${
                  myRating === 'THUMBS_DOWN'
                    ? 'bg-gray-700 text-white shadow'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                👎
              </button>
            </div>
          )}
        </div>

        {/* Player accessibility options */}
        {!needsApproval && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {/* CC Toggle */}
            <button
              onClick={handleCCToggle}
              disabled={!supportsCC}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-bold transition-all ${
                !supportsCC
                  ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400'
                  : ccEnabled
                  ? 'bg-[#1c90d8] text-white border-[#1c90d8] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-sky-300 hover:text-[#1c90d8]'
              }`}
            >
              CC Sous-titres
            </button>

            {/* Reading Mode Toggle */}
            <button
              onClick={handleReadingModeToggle}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-xs font-bold transition-all ${
                readingMode
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400 hover:text-amber-600'
              }`}
            >
              <span>📖</span>
              <span>Mode Lecture</span>
            </button>
          </div>
        )}

        {/* Reading Mode Text */}
        {Boolean(readingMode && ('description' in video) && video.description) && (
          <div className="mt-3 pt-3 border-t border-gray-100 bg-amber-50/60 rounded-2xl p-4">
            <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>📖</span>
              <span>Histoire écrite & description</span>
            </p>
            <p className="text-base leading-relaxed text-gray-800 whitespace-pre-line font-medium">
              {String(('description' in video) && video.description)}
            </p>
          </div>
        )}
      </div>

      {/* Playlist Episodes Carousel / Grid */}
      {sortedVideos.length > 1 && playlistId && (
        <section aria-label="Tous les épisodes de la chaîne" className="rounded-3xl bg-white/80 p-5 shadow-sm backdrop-blur-md border border-white/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">📺</span>
              <h2 className="text-lg font-extrabold text-gray-900">
                Autres épisodes de cette chaîne
              </h2>
            </div>
            <span className="text-xs font-bold text-gray-500">
              {currentSortedIndex + 1} / {sortedVideos.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visiblePlaylistVideos.map(({ video: item, position }) => {
              const isCurrent = item.id === videoId
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/${locale}/child/watch/${item.id}?playlist=${playlistId}`)}
                  className={`group overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                    isCurrent
                      ? 'border-[#1c90d8] bg-sky-50 ring-2 ring-[#1c90d8] shadow-md scale-[1.02]'
                      : 'border-gray-100 bg-white hover:border-sky-300 hover:shadow'
                  }`}
                >
                  <div className="relative aspect-video bg-gray-100 overflow-hidden">
                    {item.thumbnailUrl ? (
                      <RemoteImage
                        src={item.thumbnailUrl}
                        alt={item.title}
                        fill
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">
                        🎬
                      </div>
                    )}
                    <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1c90d8] text-xs font-black text-white shadow">
                      #{position}
                    </span>
                    {isCurrent && (
                      <div className="absolute inset-0 bg-sky-600/20 flex items-center justify-center">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#1c90d8] shadow">
                          En cours ▶
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className={`line-clamp-2 text-xs font-bold leading-snug ${isCurrent ? 'text-[#1c90d8]' : 'text-gray-800'}`}>
                      {item.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Sentinel for infinite scroll */}
          <div ref={playlistSentinelRef} className="py-2 flex justify-center">
            {loadingMorePlaylist && (
              <div className="flex items-center gap-2 text-xs font-bold text-[#1c90d8]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1c90d8] border-t-transparent" />
                <span>Chargement de la suite…</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Similar Videos if not in playlist */}
      {!playlistId && similarVideos.length > 0 && (
        <section aria-label="Tu pourrais aimer" className="rounded-3xl bg-white/80 p-5 shadow-sm backdrop-blur-md border border-white/80 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-extrabold text-gray-900">
              Tu pourrais aimer aussi
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {similarVideos.map(sv => (
              <button
                key={sv.id}
                onClick={() => router.push(`/${locale}/child/watch/${sv.id}`)}
                className="group overflow-hidden rounded-2xl bg-white border border-gray-100 text-left transition hover:shadow-md hover:-translate-y-1"
              >
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                  {sv.thumbnailUrl ? (
                    <RemoteImage
                      src={sv.thumbnailUrl}
                      alt={sv.title}
                      fill
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">
                      🎬
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-bold text-gray-800 group-hover:text-[#1c90d8]">
                    {sv.title}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
