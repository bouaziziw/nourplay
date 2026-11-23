'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function isTvDevice(): boolean {
  if (typeof window === 'undefined') return false
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
    ua.includes('bravia')
  )
}

interface SpatialOptions {
  containerRef?: React.RefObject<HTMLElement | null>
  enabled?: boolean
  onBack?: () => void
}

/**
 * Hook enabling seamless spatial navigation (D-Pad / télécommande TV)
 * and 10-foot TV experience for smart TV browsers.
 */
export function useTvNavigation(options: SpatialOptions = {}) {
  const { enabled = true, onBack } = options
  const router = useRouter()
  const [isTv, setIsTv] = useState<boolean>(false)
  const [showTvHelper, setShowTvHelper] = useState<boolean>(false)

  // Auto-detect TV on mount
  useEffect(() => {
    const detected = isTvDevice()
    if (detected) {
      setIsTv(true)
      document.documentElement.classList.add('tv-mode')
    }
  }, [])

  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right'): boolean => {
    const focusableSelector = [
      'a[href]:not([tabindex="-1"])',
      'button:not([disabled]):not([tabindex="-1"])',
      'input:not([disabled]):not([tabindex="-1"])',
      '[tabindex="0"]',
    ].join(', ')

    const elements = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => {
      // Must be visible
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
    })

    if (elements.length === 0) return false

    const current = (document.activeElement as HTMLElement) || null
    if (!current || !elements.includes(current)) {
      // Focus first prominent interactive element
      elements[0].focus()
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
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
        // Weighted Manhattan-Euclidean distance favoring straight lines in current direction
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
      // Activate TV mode on first arrow key press if not already active
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!document.documentElement.classList.contains('tv-mode')) {
          document.documentElement.classList.add('tv-mode')
          setIsTv(true)
        }
        setShowTvHelper(true)
      }

      // Handle D-Pad / Arrow keys
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
        (e as unknown as { keyCode: number }).keyCode === 10009 || // Tizen Return
        (e as unknown as { keyCode: number }).keyCode === 461 // WebOS Back
      ) {
        // If not typing in an input
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
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, moveFocus, onBack, router])

  return { isTv, showTvHelper, moveFocus }
}
