'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  sessionLimitMin: number | null
  dailyLimitMin: number | null
  activatedAt: number
  dailyWatchedSec?: number | null
  onExpire?: () => void
}

function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function ChildCountdownTimer({
  sessionLimitMin,
  dailyLimitMin,
  activatedAt,
  dailyWatchedSec = null,
  onExpire,
}: Props) {
  // If neither limit is set, do not show timer
  const hasLimit = Boolean(sessionLimitMin || dailyLimitMin)

  const calculateRemaining = useCallback(() => {
    const elapsedSec = Math.floor((Date.now() - activatedAt) / 1000)
    let sessionRemainingSec = Infinity
    let dailyRemainingSec = Infinity

    if (sessionLimitMin && sessionLimitMin > 0) {
      sessionRemainingSec = Math.max(0, sessionLimitMin * 60 - elapsedSec)
    }

    if (dailyLimitMin && dailyLimitMin > 0 && dailyWatchedSec !== null && dailyWatchedSec !== undefined) {
      dailyRemainingSec = Math.max(0, dailyLimitMin * 60 - (dailyWatchedSec + elapsedSec))
    }

    const minRemaining = Math.min(sessionRemainingSec, dailyRemainingSec)
    return minRemaining === Infinity ? null : minRemaining
  }, [activatedAt, dailyLimitMin, dailyWatchedSec, sessionLimitMin])

  const [remainingSec, setRemainingSec] = useState<number | null>(calculateRemaining)

  useEffect(() => {
    if (!hasLimit) return

    const update = () => {
      const remaining = calculateRemaining()
      setRemainingSec(remaining)
      if (remaining !== null && remaining <= 0) {
        onExpire?.()
      }
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [hasLimit, calculateRemaining, onExpire])

  if (!hasLimit || remainingSec === null) return null

  // Visual appearance based on remaining time
  const isCritical = remainingSec <= 60
  const isWarning = remainingSec > 60 && remainingSec <= 300

  let badgeClasses = 'bg-sky-50 border-sky-300 text-sky-800'
  let icon = (
    <svg className="w-3.5 h-3.5 text-[#1c90d8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  )

  if (isCritical) {
    badgeClasses = 'bg-red-50 border-red-300 text-red-600 animate-pulse ring-2 ring-red-200'
    icon = (
      <svg className="w-3.5 h-3.5 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  } else if (isWarning) {
    badgeClasses = 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
    icon = (
      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      </svg>
    )
  }

  return (
    <div
      title={
        sessionLimitMin && dailyLimitMin
          ? `Limite de session: ${sessionLimitMin} min | Limite du jour: ${dailyLimitMin} min`
          : sessionLimitMin
          ? `Limite de session: ${sessionLimitMin} min`
          : `Limite journalière: ${dailyLimitMin} min`
      }
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all duration-300 shadow-sm ${badgeClasses}`}
      aria-label={`Temps restant : ${formatTime(remainingSec)}`}
    >
      {icon}
      <span className="font-mono text-xs tracking-tight">{formatTime(remainingSec)}</span>
    </div>
  )
}
