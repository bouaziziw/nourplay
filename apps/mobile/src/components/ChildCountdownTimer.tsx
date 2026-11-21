import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native'

interface Props {
  sessionLimitMin: number | null
  activatedAt: number
  dailyLimitMin?: number | null
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
  activatedAt,
  dailyLimitMin = null,
  onExpire,
}: Props) {
  const hasLimit = Boolean(sessionLimitMin || dailyLimitMin)

  const calculateRemaining = useCallback(() => {
    const elapsedSec = Math.floor((Date.now() - activatedAt) / 1000)
    let sessionRemainingSec = Infinity

    if (sessionLimitMin && sessionLimitMin > 0) {
      sessionRemainingSec = Math.max(0, sessionLimitMin * 60 - elapsedSec)
    }

    return sessionRemainingSec === Infinity ? null : sessionRemainingSec
  }, [activatedAt, sessionLimitMin])

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

  const isCritical = remainingSec <= 60
  const isWarning = remainingSec > 60 && remainingSec <= 300

  let containerStyle: StyleProp<ViewStyle> = styles.containerNormal
  let textStyle: StyleProp<TextStyle> = styles.textNormal

  if (isCritical) {
    containerStyle = styles.containerCritical
    textStyle = styles.textCritical
  } else if (isWarning) {
    containerStyle = styles.containerWarning
    textStyle = styles.textWarning
  }

  return (
    <View style={[styles.badge, containerStyle]}>
      <Text style={textStyle}>⏱️ {formatTime(remainingSec)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerNormal: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  textNormal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  containerWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  textWarning: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  containerCritical: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  textCritical: {
    fontSize: 12,
    fontWeight: '800',
    color: '#dc2626',
  },
})
