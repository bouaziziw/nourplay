'use client'

import { getPreset } from '../lib/avatars'
import { RemoteImage } from './RemoteImage'

interface Props {
  avatarKey?: string | null
  displayName: string
  size?: number
  className?: string
}

export function ProfileAvatar({ avatarKey, displayName, size = 40, className = '' }: Props) {
  const preset = getPreset(avatarKey)

  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  if (preset) {
    return (
      <div
        style={{ ...style, background: preset.bg, fontSize: size * 0.45 }}
        className={className}
        aria-label={preset.label}
      >
        {preset.emoji}
      </div>
    )
  }

  if (avatarKey && !avatarKey.startsWith('preset:')) {
    const src = `${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${avatarKey}`
    return (
      <div style={style} className={className}>
        <RemoteImage src={src} alt={displayName} width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  const initials = displayName.slice(0, 2).toUpperCase()
  return (
    <div
      style={{ ...style, background: '#e0e7ff', color: '#4f46e5', fontSize: size * 0.35, fontWeight: 700 }}
      className={className}
    >
      {initials}
    </div>
  )
}
