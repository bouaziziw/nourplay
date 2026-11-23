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
  onBack,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mountTimeRef = useRef<number>(Date.now())
  const firedRef = useRef(false)
  const completedRef = useRef(false)

  // Smart TV detection & Player State
  const [isTv, setIsTv] = useState<boolean>(Boolean(tvMode))
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [playerReady, setPlayerReady] = useState<boolean>(false)

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

  // Auto-start and quickly pause video on load in TV mode
  const handleIframeLoad = useCallback(() => {
    setPlayerReady(true)

    // Requirement: La vidéo doit démarrer automatiquement puis être mise en pause rapidement
    // afin que le décodeur et le flux soient préchargés et que l'utilisateur puisse la contrôler facilement.
    sendPlayerCommand('playVideo')

    const pauseTimer = setTimeout(() => {
      sendPlayerCommand('pauseVideo')
      setIsPlaying(false)
      setStatusMessage('Prêt à regarder 🍿')

      // Requirement: Activer les commandes rapides par défaut
      const primaryBtn = containerRef.current?.querySelector<HTMLElement>('[data-tv-focus="primary"]')
      if (primaryBtn) {
        primaryBtn.focus()
      }
    }, 850)

    return () => clearTimeout(pauseTimer)
  }, [sendPlayerCommand])

  // Focus primary quick command button on load
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      const primaryBtn = containerRef.current?.querySelector<HTMLElement>('[data-tv-focus="primary"]')
      if (primaryBtn && typeof primaryBtn.focus === 'function') {
        primaryBtn.focus()
      }
    }, 400)
    return () => clearTimeout(focusTimer)
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
      setStatusMessage('Lecture en cours ▶')
    }
  }, [isPlaying, sendPlayerCommand])

  const handleRewind10 = useCallback(() => {
    sendPlayerCommand('seekTo', Math.max(0, elapsedSec() - 10))
    setStatusMessage('Recul de 10s ◀◀')
  }, [sendPlayerCommand, elapsedSec])

  const handleForward10 = useCallback(() => {
    sendPlayerCommand('seekTo', elapsedSec() + 10)
    setStatusMessage('Avance de 10s ▶▶')
  }, [sendPlayerCommand, elapsedSec])

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
  }, [isMuted, sendPlayerCommand])

  // Fullscreen management across Smart TV & Desktop browsers
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
  }, [])

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

      // Fullscreen quick command (F or TV dedicated key)
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        handleToggleFullscreen()
        return
      }

      // Play / Pause quick commands (Space, Enter, K, or TV Media keys)
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

      // Rewind quick commands (-10s: J, ArrowLeft, or TV Rewind)
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

      // Forward quick commands (+10s: L, ArrowRight, or TV FastForward)
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

      // Mute / Unmute quick command (M)
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        handleToggleMute()
        return
      }

      // Next video quick command (N or TV Next key)
      if ((e.key === 'n' || e.key === 'N' || e.key === 'MediaTrackNext' || keyCode === 10253) && onNext) {
        e.preventDefault()
        onNext()
        return
      }
    }

    window.addEventListener('keydown', handleRemoteKeys)
    return () => window.removeEventListener('keydown', handleRemoteKeys)
  }, [handleTogglePlay, handleRewind10, handleForward10, handleToggleFullscreen, handleToggleMute, onNext])

  const safeUrl = buildSafeEmbedUrl(embedUrl, startAt, ccEnabled, isTv)
  const isYouTube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')
  const isDailymotion = embedUrl.includes('dailymotion.com')
  const supportCC = isYouTube || isDailymotion

  return (
    <div
      ref={containerRef}
      className={`tv-player-container rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 shadow-2xl border border-white/10 flex flex-col transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none w-screen h-screen' : ''
      }`}
    >
      {/* 16:9 Video Canvas */}
      <div
        className={`tv-player-canvas relative w-full bg-black ${
          isFullscreen ? 'flex-1 min-h-0' : ''
        }`}
        style={isFullscreen ? { height: 'calc(100vh - 72px)' } : { paddingBottom: '56.25%' }}
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
      </div>

      {/* ── Smart TV Navigation & Playback Controls Bar ── */}
      <div className="bg-slate-900/95 border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-3 text-white">
        {/* Quick Commands Header & Remote Guide (Active by default) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-black uppercase tracking-wider text-sky-400 bg-sky-950/80 border border-sky-800/80 px-2.5 py-1 rounded-lg shadow-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>⚡ Commandes rapides</span>
            </span>
            {statusMessage && (
              <span className="text-xs font-bold text-sky-200 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                {statusMessage}
              </span>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-black/40 px-3 py-1 rounded-lg border border-white/5">
            <span>[OK / Espace] Lecture</span>
            <span>•</span>
            <span>[◀◀ / ▶▶] ±10s</span>
            <span>•</span>
            <span>[F] Plein écran</span>
            <span>•</span>
            <span>[M] Sourdine</span>
            {onNext && (
              <>
                <span>•</span>
                <span>[N] Suivant</span>
              </>
            )}
          </div>
        </div>

        {/* Playback action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Main Play / Pause Button with Primary TV Focus */}
          <button
            type="button"
            data-tv-focus="primary"
            onClick={handleTogglePlay}
            className={`tv-btn flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 font-black text-sm transition-all shadow-md active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-[#1c90d8] hover:bg-sky-400 text-white'
            }`}
            title="Lecture / Pause (Touche OK ou Espace)"
          >
            <span className="text-lg">{isPlaying ? '⏸' : '▶'}</span>
            <span>{isPlaying ? 'Pause' : 'Lecture'}</span>
          </button>

          {/* -10s Rewind */}
          <button
            type="button"
            onClick={handleRewind10}
            className="tv-btn flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all active:scale-95"
            title="Reculer de 10 secondes"
          >
            <span>◀◀</span>
            <span>-10s</span>
          </button>

          {/* +10s Forward */}
          <button
            type="button"
            onClick={handleForward10}
            className="tv-btn flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all active:scale-95"
            title="Avancer de 10 secondes"
          >
            <span>+10s</span>
            <span>▶▶</span>
          </button>

          {/* Next Episode Button */}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="tv-btn flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 text-xs sm:text-sm font-black transition-all shadow-md active:scale-95"
              title="Passer à l'épisode suivant"
            >
              <span>Épisode suivant</span>
              <span>⏭️</span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="tv-btn flex items-center justify-center gap-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all active:scale-95"
            title={isFullscreen ? 'Quitter le plein écran (Touche Échap ou F)' : 'Plein écran (Touche F)'}
          >
            <span className="text-base">{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? 'Réduire' : 'Plein écran'}</span>
          </button>

          {/* Mute / Unmute */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="tv-btn flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 p-2.5 text-sm font-bold text-white transition-all"
            title="Couper / Activer le son"
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
          </button>
        </div>

        {/* Secondary Info & CC */}
        <div className="flex items-center gap-3">
          {statusMessage && (
            <span className="text-xs font-bold text-sky-400 bg-sky-950/70 border border-sky-800/60 px-3 py-1.5 rounded-xl">
              {statusMessage}
            </span>
          )}

          {onCCToggle && (
            <button
              type="button"
              onClick={onCCToggle}
              disabled={!supportCC}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                !supportCC
                  ? 'opacity-30 cursor-not-allowed border-white/10 text-white/30'
                  : ccEnabled
                  ? 'bg-white text-black border-white'
                  : 'bg-white/10 text-white/80 border-white/20 hover:border-white/50'
              }`}
              title="Sous-titres"
            >
              CC
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
)
}
