'use client'

import { useRef, useEffect, useCallback } from 'react'

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
}

function buildSafeEmbedUrl(raw: string, startAt = 0, ccEnabled = false): string {
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
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=0&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : '')}${start}${cc}`
    }

    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (!videoId) return raw
      const hash = startAt > 0 ? `#t=${startAt}s` : ''
      return `https://player.vimeo.com/video/${videoId}?dnt=1&byline=0&title=0&portrait=0${hash}`
    }

    // Dailymotion
    if (u.hostname.includes('dailymotion.com')) {
      const videoId = u.pathname.split('/').pop()
      if (!videoId) return raw
      const start = startAt > 0 ? `&start=${startAt}` : ''
      const subtitles = ccEnabled ? '&subtitles=1' : ''
      return `https://www.dailymotion.com/embed/video/${videoId}?sharing-enable=false&ui-logo=false${start}${subtitles}`
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
}: Props) {
  const mountTimeRef = useRef<number>(Date.now())
  const firedRef = useRef(false)
  const completedRef = useRef(false)

  const elapsedSec = useCallback(() => {
    return startAt + Math.round((Date.now() - mountTimeRef.current) / 1000)
  }, [startAt])

  const fireWatched = useCallback((completed: boolean) => {
    if (firedRef.current) return
    firedRef.current = true
    onWatched?.(elapsedSec(), completed)
  }, [onWatched, elapsedSec])

  // Reset on video change
  useEffect(() => {
    mountTimeRef.current = Date.now()
    firedRef.current = false
    completedRef.current = false

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

  const safeUrl = buildSafeEmbedUrl(embedUrl, startAt, ccEnabled)
  const isYouTube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')
  const isDailymotion = embedUrl.includes('dailymotion.com')
  const supportCC = isYouTube || isDailymotion

  return (
    <div className="rounded-xl overflow-hidden bg-black shadow-2xl">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={safeUrl}
          title={title}
          allow="accelerometer; encrypted-media; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
        />
      </div>
      {onCCToggle && (
        <div className="flex items-center justify-end px-3 py-1.5 bg-black/95">
          <button
            onClick={onCCToggle}
            disabled={!supportCC}
            title={
              !supportCC ? 'Sous-titres non disponibles pour cette source'
              : ccEnabled ? 'Désactiver les sous-titres'
              : 'Activer les sous-titres'
            }
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded border transition-all ${
              !supportCC
                ? 'opacity-30 cursor-not-allowed border-white/20 text-white/30'
                : ccEnabled
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-white/60 border-white/30 hover:border-white/70 hover:text-white/90'
            }`}
          >
            CC
          </button>
        </div>
      )}
    </div>
  )
}
