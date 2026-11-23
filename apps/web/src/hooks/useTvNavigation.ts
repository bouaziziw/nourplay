'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function isTvDevice(): boolean {
  if (typeof window === 'undefined') return false

  // Explicit URL parameter check (?tv=1, ?tv=true, ?tv, ?mode=tv, etc.)
  try {
    const search = window.location.search.toLowerCase()
    if (
      search.includes('tv=1') ||
      search.includes('tv=true') ||
      search.includes('mode=tv') ||
      search.includes('tv=yes') ||
      search === '?tv' ||
      search.includes('&tv') ||
      search.includes('?tv&')
    ) {
      localStorage.setItem('nourplay:tv-mode', '1')
      return true
    }

    // LocalStorage preference check
    if (localStorage.getItem('nourplay:tv-mode') === '1') return true
  } catch {
    // Ignore localStorage security errors
  }

  const ua = navigator.userAgent.toLowerCase()
  return (
    ua.includes('tizen') ||
    ua.includes('smarttv') ||
    ua.includes('web0s') ||
    ua.includes('webos') ||
    ua.includes('netcast') ||
    (ua.includes('android') && (ua.includes('tv') || ua.includes('googletv') || ua.includes('crkey'))) ||
    ua.includes('aft') || // Amazon Fire TV
    ua.includes('appletv') ||
    ua.includes('hbbtv') ||
    ua.includes('viera') ||
    ua.includes('bravia') ||
    ua.includes('opera tv') ||
    ua.includes('kylo')
  )
}

export interface SpatialOptions {
  containerRef?: React.RefObject<HTMLElement | null>
  enabled?: boolean
  onBack?: () => void
  onPlayPause?: () => void
  onRewind?: () => void
  onForward?: () => void
  onNext?: () => void
  autoFocusPrimary?: boolean
}

/**
 * Hook enabling seamless spatial navigation (D-Pad / télécommande TV),
 * multimedia keys mapping, and 10-foot TV experience for Smart TV browsers.
 */
export function useTvNavigation(options: SpatialOptions = {}) {
  const {
    enabled = true,
    onBack,
    onPlayPause,
    onRewind,
    onForward,
    onNext,
    autoFocusPrimary = true,
  } = options
  const router = useRouter()
  const [isTv, setIsTv] = useState<boolean>(false)
  const [showTvHelper, setShowTvHelper] = useState<boolean>(false)
  const helperTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-detect TV on mount and show quick commands helper by default
  useEffect(() => {
    const detected = isTvDevice()
    if (detected) {
      setIsTv(true)
      document.documentElement.classList.add('tv-mode')
      setShowTvHelper(true)
      if (helperTimerRef.current) clearTimeout(helperTimerRef.current)
      helperTimerRef.current = setTimeout(() => {
        setShowTvHelper(false)
      }, 6000)
    }
  }, [])

  // Auto-focus primary TV element on page load in TV mode
  useEffect(() => {
    if (!enabled || !autoFocusPrimary) return

    const timer = setTimeout(() => {
      const primary = document.querySelector<HTMLElement>('[data-tv-focus="primary"]')
      if (primary && typeof primary.focus === 'function') {
        primary.focus()
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [enabled, autoFocusPrimary])

  const triggerHelperBriefly = useCallback(() => {
    setShowTvHelper(true)
    if (helperTimerRef.current) clearTimeout(helperTimerRef.current)
    // Automatically fades out after 4 seconds to avoid screen clutter
    helperTimerRef.current = setTimeout(() => {
      setShowTvHelper(false)
    }, 4000)
  }, [])

  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right'): boolean => {
    const focusableSelector = [
      'a[href]:not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      '[tabindex="0"]',
    ].join(', ')

    const elements = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })

    if (elements.length === 0) return false

    const current = (document.activeElement as HTMLElement) || null
    if (!current || !elements.includes(current)) {
      // Focus element with data-tv-focus="primary" first, else first interactive element
      const primary = elements.find(el => el.getAttribute('data-tv-focus') === 'primary') || elements[0]
      primary.focus()
      primary.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      return true
    }

    const curRect = current.getBoundingClientRect()
    const curCenter = { x: curRect.left + curRect.width / 2, y: curRect.top + curRect.height / 2 }

    let bestElement: HTMLElement | null = null
    let bestScore = Infinity

    for (const el of elements) {
      if (el === current) continue
      const rect = el.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

      const dx = center.x - curCenter.x
      const dy = center.y - curCenter.y

      let isCandidate = false
      let primaryDist = 0
      let orthogonalDist = 0

      switch (direction) {
        case 'right':
          isCandidate = rect.left >= curRect.left + 5 && Math.abs(dy) < Math.max(curRect.height, rect.height) * 1.5
          primaryDist = dx
          orthogonalDist = Math.abs(dy)
          break
        case 'left':
          isCandidate = rect.right <= curRect.right - 5 && Math.abs(dy) < Math.max(curRect.height, rect.height) * 1.5
          primaryDist = -dx
          orthogonalDist = Math.abs(dy)
          break
        case 'down':
          isCandidate = rect.top >= curRect.top + 5
          primaryDist = dy
          orthogonalDist = Math.abs(dx)
          break
        case 'up':
          isCandidate = rect.bottom <= curRect.bottom - 5
          primaryDist = -dy
          orthogonalDist = Math.abs(dx)
          break
      }

      if (isCandidate && primaryDist > 0) {
        const score = primaryDist + orthogonalDist * 2.2
        if (score < bestScore) {
          bestScore = score
          bestElement = el
        }
      }
    }

    if (bestElement) {
      bestElement.focus()
      bestElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      return true
    }

    return false
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyCode = (e as unknown as { keyCode?: number }).keyCode || 0

      // Activate TV mode on first arrow key press if not already active
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!document.documentElement.classList.contains('tv-mode')) {
          document.documentElement.classList.add('tv-mode')
          setIsTv(true)
          localStorage.setItem('nourplay:tv-mode', '1')
        }
        triggerHelperBriefly()
      }

      // 1. Multimedia Keys (Play/Pause, Rewind, Forward, Next)
      if (
        e.key === 'MediaPlayPause' ||
        e.key === 'MediaPlay' ||
        e.key === 'MediaPause' ||
        keyCode === 10252 || // Samsung Play/Pause
        keyCode === 415 ||   // Samsung / LG Play
        keyCode === 19       // Samsung / LG Pause
      ) {
        if (onPlayPause) {
          e.preventDefault()
          onPlayPause()
          return
        }
      }

      if (
        e.key === 'MediaRewind' ||
        keyCode === 412 // Samsung / LG Rewind
      ) {
        if (onRewind) {
          e.preventDefault()
          onRewind()
          return
        }
      }

      if (
        e.key === 'MediaFastForward' ||
        keyCode === 417 // Samsung / LG FastForward
      ) {
        if (onForward) {
          e.preventDefault()
          onForward()
          return
        }
      }

      if (
        e.key === 'MediaTrackNext' ||
        keyCode === 10253 // Samsung Track Next
      ) {
        if (onNext) {
          e.preventDefault()
          onNext()
          return
        }
      }

      // 2. Navigation D-Pad
      if (e.key === 'ArrowUp') {
        const moved = moveFocus('up')
        if (moved) e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        const moved = moveFocus('down')
        if (moved) e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        const moved = moveFocus('left')
        if (moved) e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        const moved = moveFocus('right')
        if (moved) e.preventDefault()
      } else if (
        e.key === 'Escape' ||
        e.key === 'Backspace' ||
        e.key === 'GoBack' ||
        keyCode === 10009 || // Samsung Tizen Return
        keyCode === 461      // LG webOS Back
      ) {
        const tag = (document.activeElement?.tagName || '').toLowerCase()
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault()
          if (onBack) {
            onBack()
          } else {
            router.back()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (helperTimerRef.current) clearTimeout(helperTimerRef.current)
    }
  }, [enabled, moveFocus, onBack, onPlayPause, onRewind, onForward, onNext, router, triggerHelperBriefly])

  return { isTv, showTvHelper, moveFocus }
}
