'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { isTvDevice } from '../hooks/useTvNavigation'

interface Props {
  embedUrl: string
  title: string
  startAt?: number
  ccEnabled?: boolean
  onCCToggle?: () => void
  onWatched?: (durationSec: number, completed: boolean) => void
  onProgress?: (positionSec: number) => void
  progressIntervalSec?: number
  autoMarkCompleteAfterSec?: number
  tvMode?: boolean
  onNext?: () => void
  onBack?: () => void
}

function buildSafeEmbedUrl(raw: string, startAt = 0, ccEnabled = false, autoStart = false): string {
  try {
    const u = new URL(raw)

    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId = ''
      if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.replace('/embed/', '').split('/')[0]
      } else if (u.searchParams.has('v')) {
        videoId = u.searchParams.get('v')!
      } else if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1)
      }
      if (!videoId) return raw

      const start = startAt > 0 ? `&start=${startAt}` : ''
      const cc = ccEnabled ? '&cc_load_policy=1&cc_lang_pref=fr' : '&cc_load_policy=0'
      const autoplayParam = autoStart ? '&autoplay=1&mute=1' : '&autoplay=0'

      // Enable JS API so remote commands (play, pause, seek, mute) work reliably
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}${autoplayParam}${start}${cc}`
    }

    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (!videoId) return raw
      const hash = startAt > 0 ? `#t=${startAt}s` : ''
      const autoplay = autoStart ? '&autoplay=1&muted=1' : ''
      return `https://player.vimeo.com/video/${videoId}?dnt=1&byline=0&title=0&portrait=0&api=1${autoplay}${hash}`
    }

    // Dailymotion
    if (u.hostname.includes('dailymotion.com')) {
      const videoId = u.pathname.split('/').pop()
      if (!videoId) return raw
      const start = startAt > 0 ? `&start=${startAt}` : ''
      const subtitles = ccEnabled ? '&subtitles=1' : ''
      const autoplay = autoStart ? '&autoplay=1&mute=1' : ''
      return `https://www.dailymotion.com/embed/video/${videoId}?sharing-enable=false&ui-logo=false&api=postMessage${autoplay}${start}${subtitles}`
    }

    return raw
  } catch {
    return raw
  }
}

export function VideoPlayer({
  embedUrl,
  title,
  startAt = 0,
  ccEnabled = false,
  onCCToggle,
  onWatched,
  onProgress,
  progressIntervalSec = 15,
  autoMarkCompleteAfterSec = 300,
  tvMode,
  onNext,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mountTimeRef = useRef<number>(Date.now())
  const firedRef = useRef(false)
  const completedRef = useRef(false)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Player state & controls visibility
  const [isTv, setIsTv] = useState<boolean>(Boolean(tvMode))
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [, setPlayerReady] = useState<boolean>(false)
  const [showControls, setShowControls] = useState<boolean>(false)

  useEffect(() => {
    if (tvMode !== undefined) {
      setIsTv(tvMode)
    } else {
      setIsTv(isTvDevice())
    }
  }, [tvMode])

  const elapsedSec = useCallback(() => {
    return startAt + Math.round((Date.now() - mountTimeRef.current) / 1000)
  }, [startAt])

  const fireWatched = useCallback((completed: boolean) => {
    if (firedRef.current) return
    firedRef.current = true
    onWatched?.(elapsedSec(), completed)
  }, [onWatched, elapsedSec])

  // Reset timers on video change
  useEffect(() => {
    mountTimeRef.current = Date.now()
    firedRef.current = false
    completedRef.current = false
    setPlayerReady(false)
    setIsPlaying(false)
    setShowControls(false)

    const completeTimer = setTimeout(() => {
      completedRef.current = true
    }, autoMarkCompleteAfterSec * 1000)

    return () => {
      clearTimeout(completeTimer)
      fireWatched(completedRef.current)
    }
  }, [embedUrl, autoMarkCompleteAfterSec, fireWatched])

  // Periodic progress reporting
  useEffect(() => {
    if (!onProgress) return
    const id = setInterval(() => {
      onProgress(elapsedSec())
    }, progressIntervalSec * 1000)
    return () => clearInterval(id)
  }, [onProgress, progressIntervalSec, elapsedSec])

  // PostMessage command sender
  const sendPlayerCommand = useCallback((func: string, args: unknown = '') => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    try {
      // YouTube API
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      )
      // Vimeo API
      if (func === 'playVideo') {
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*')
      } else if (func === 'pauseVideo') {
        iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*')
      }
    } catch {
      // Ignore cross-origin postMessage failures
    }
  }, [])

  // Auto-hide controls timer
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3500)
  }, [])

  // Interactive controls
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      sendPlayerCommand('pauseVideo')
      setIsPlaying(false)
      setStatusMessage('En pause ⏸')
    } else {
      sendPlayerCommand('playVideo')
      setIsPlaying(true)
      setStatusMessage('Lecture ▶')
    }
    resetHideTimer()
  }, [isPlaying, sendPlayerCommand, resetHideTimer])

  const handleRewind10 = useCallback(() => {
    sendPlayerCommand('seekTo', Math.max(0, elapsedSec() - 10))
    setStatusMessage('-10s ◀◀')
    resetHideTimer()
  }, [sendPlayerCommand, elapsedSec, resetHideTimer])

  const handleForward10 = useCallback(() => {
    sendPlayerCommand('seekTo', elapsedSec() + 10)
    setStatusMessage('+10s ▶▶')
    resetHideTimer()
  }, [sendPlayerCommand, elapsedSec, resetHideTimer])

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      sendPlayerCommand('unMute')
      setIsMuted(false)
      setStatusMessage('Son activé 🔊')
    } else {
      sendPlayerCommand('mute')
      setIsMuted(true)
      setStatusMessage('Son coupé 🔇')
    }
    resetHideTimer()
  }, [isMuted, sendPlayerCommand, resetHideTimer])

  // Click on video: afficher les commandes rapides ou basculer play/pause
  const handleVideoClick = useCallback(() => {
    if (!showControls) {
      setShowControls(true)
      resetHideTimer()
    } else {
      handleTogglePlay()
    }
  }, [showControls, handleTogglePlay, resetHideTimer])

  // Mouse moves out of the player container: disparu lorsque je bouge la souris de l'écran de lecture
  const handleMouseLeave = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowControls(false)
  }, [])

  // Mouse moves within the player: keep hide timer refreshed
  const handleMouseMove = useCallback(() => {
    if (showControls) {
      resetHideTimer()
    }
  }, [showControls, resetHideTimer])

  // Auto-start and quickly pause video on load in TV mode
  const handleIframeLoad = useCallback(() => {
    setPlayerReady(true)

    sendPlayerCommand('playVideo')

    const pauseTimer = setTimeout(() => {
      sendPlayerCommand('pauseVideo')
      setIsPlaying(false)
      setStatusMessage('Prêt à regarder 🍿')
    }, 850)

    return () => clearTimeout(pauseTimer)
  }, [sendPlayerCommand])

  // Fullscreen management
  const handleToggleFullscreen = useCallback(() => {
    const doc = document as any
    const container = containerRef.current as any

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(() => {})
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen()
      } else if (container?.mozRequestFullScreen) {
        container.mozRequestFullScreen()
      } else if (container?.msRequestFullscreen) {
        container.msRequestFullscreen()
      }
      setStatusMessage('Plein écran ⛶')
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {})
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen()
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen()
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen()
      }
      setStatusMessage('Écran normal')
    }
    resetHideTimer()
  }, [resetHideTimer])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any
      const isNowFull = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      )
      setIsFullscreen(isNowFull)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  // TV Remote & Keyboard Quick Commands handling
  useEffect(() => {
    const handleRemoteKeys = (e: KeyboardEvent) => {
      const keyCode = (e as unknown as { keyCode?: number }).keyCode || 0
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      // Any player keypress displays controls and resets timer
      setShowControls(true)
      resetHideTimer()

      // Fullscreen quick command (F)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        handleToggleFullscreen()
        return
      }

      // Play / Pause quick commands (Space, Enter, K)
      if (
        e.key === ' ' ||
        e.code === 'Space' ||
        e.key === 'k' ||
        e.key === 'K' ||
        e.key === 'MediaPlayPause' ||
        e.key === 'MediaPlay' ||
        e.key === 'MediaPause' ||
        keyCode === 10252 ||
        keyCode === 415 ||
        keyCode === 19
      ) {
        e.preventDefault()
        handleTogglePlay()
        return
      }

      // Rewind quick commands (-10s: J, ArrowLeft)
      if (
        e.key === 'j' ||
        e.key === 'J' ||
        e.key === 'MediaRewind' ||
        keyCode === 412
      ) {
        e.preventDefault()
        handleRewind10()
        return
      }

      // Forward quick commands (+10s: L, ArrowRight)
      if (
        e.key === 'l' ||
        e.key === 'L' ||
        e.key === 'MediaFastForward' ||
        keyCode === 417
      ) {
        e.preventDefault()
        handleForward10()
        return
      }

      // Mute / Unmute (M)
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        handleToggleMute()
        return
      }

      // Next video (N)
      if ((e.key === 'n' || e.key === 'N' || e.key === 'MediaTrackNext' || keyCode === 10253) && onNext) {
        e.preventDefault()
        onNext()
        return
      }
    }

    window.addEventListener('keydown', handleRemoteKeys)
    return () => window.removeEventListener('keydown', handleRemoteKeys)
  }, [handleTogglePlay, handleRewind10, handleForward10, handleToggleFullscreen, handleToggleMute, onNext, resetHideTimer])

  const safeUrl = buildSafeEmbedUrl(embedUrl, startAt, ccEnabled, isTv)
  const isYouTube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')
  const isDailymotion = embedUrl.includes('dailymotion.com')
  const supportCC = isYouTube || isDailymotion

  return (
    <div
      ref={containerRef}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      className={`tv-player-container relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 flex flex-col transition-all select-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none w-screen h-screen' : ''
      }`}
    >
      {/* 16:9 Video Canvas */}
      <div
        className={`tv-player-canvas relative w-full bg-black ${
          isFullscreen ? 'flex-1 min-h-0' : ''
        }`}
        style={isFullscreen ? { height: '100vh' } : { paddingBottom: '56.25%' }}
      >
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          className="absolute inset-0 w-full h-full"
          src={safeUrl}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        />

        {/* Click detection layer over video to toggle controls / play-pause */}
        <div
          onClick={handleVideoClick}
          className="absolute inset-0 z-10 cursor-pointer"
          title="Cliquer pour afficher les commandes ou mettre en pause"
        />

        {/* ── Bloc des Commandes Rapides (Taille réduite, flottant, affiché au clic, masqué quand la souris quitte) ── */}
        <div
          className={`absolute bottom-0 inset-x-0 z-20 transition-all duration-300 ${
            showControls
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 sm:p-3.5 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 backdrop-blur-md border border-white/15 rounded-xl sm:rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 shadow-2xl text-white">
              
              {/* Actions de lecture principales */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Bouton Lecture / Pause */}
                <button
                  type="button"
                  data-tv-focus="primary"
                  onClick={handleTogglePlay}
                  className={`flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl px-3 py-1 sm:px-3.5 sm:py-1.5 font-black text-xs sm:text-sm transition-all shadow active:scale-95 ${
                    isPlaying
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-[#1c90d8] hover:bg-sky-400 text-white'
                  }`}
                  title="Lecture / Pause (Espace ou OK)"
                >
                  <span>{isPlaying ? '⏸' : '▶'}</span>
                  <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
                </button>

                {/* Reculer 10s */}
                <button
                  type="button"
                  onClick={handleRewind10}
                  className="flex items-center justify-center gap-1 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 text-xs font-bold text-white transition-all active:scale-95"
                  title="Reculer de 10s"
                >
                  <span>◀◀</span>
                  <span>-10s</span>
                </button>

                {/* Avancer 10s */}
                <button
                  type="button"
                  onClick={handleForward10}
                  className="flex items-center justify-center gap-1 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 text-xs font-bold text-white transition-all active:scale-95"
                  title="Avancer de 10s"
                >
                  <span>+10s</span>
                  <span>▶▶</span>
                </button>

                {/* Épisode Suivant */}
                {onNext && (
                  <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center justify-center gap-1 rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-black transition-all shadow active:scale-95"
                    title="Épisode suivant"
                  >
                    <span>Suivant</span>
                    <span>⏭️</span>
                  </button>
                )}

                {/* Badge compact discret */}
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Commandes</span>
                </span>
              </div>

              {/* Statut, sous-titres, son et plein écran */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {statusMessage && (
                  <span className="text-[11px] font-bold text-sky-300 bg-white/10 border border-white/10 px-2 py-0.5 rounded-md">
                    {statusMessage}
                  </span>
                )}

                {onCCToggle && (
                  <button
                    type="button"
                    onClick={onCCToggle}
                    disabled={!supportCC}
                    className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-md border transition-all ${
                      !supportCC
                        ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30'
                        : ccEnabled
                        ? 'bg-white text-black border-white'
                        : 'bg-white/10 text-white border-white/20 hover:border-white/50'
                    }`}
                    title="Sous-titres"
                  >
                    CC
                  </button>
                )}

                {/* Son / Sourdine */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  className="flex items-center justify-center rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 p-1 text-xs font-bold text-white transition-all"
                  title="Couper / Activer le son"
                >
                  <span>{isMuted ? '🔇' : '🔊'}</span>
                </button>

                {/* Plein écran */}
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="flex items-center justify-center gap-1 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-2 py-1 text-xs font-bold text-white transition-all active:scale-95"
                  title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                >
                  <span>{isFullscreen ? '🗗' : '⛶'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
