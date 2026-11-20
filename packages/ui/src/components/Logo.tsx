import React from 'react'

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  subtitle?: string
  className?: string
  textClassName?: string
  iconClassName?: string
  theme?: 'dark' | 'light'
}

const sizeConfig = {
  xs: { iconSize: 24, fontSize: 'text-sm', badgeSize: 'text-[10px] px-1 py-0.2', gap: 'gap-1.5' },
  sm: { iconSize: 32, fontSize: 'text-base', badgeSize: 'text-[10px] px-1.5 py-0.5', gap: 'gap-2' },
  md: { iconSize: 40, fontSize: 'text-xl', badgeSize: 'text-xs px-2 py-0.5', gap: 'gap-2.5' },
  lg: { iconSize: 48, fontSize: 'text-2xl', badgeSize: 'text-xs px-2.5 py-0.5', gap: 'gap-3' },
  xl: { iconSize: 64, fontSize: 'text-3xl', badgeSize: 'text-sm px-3 py-1', gap: 'gap-3.5' },
}

export function Logo({
  size = 'md',
  showText = true,
  subtitle,
  className = '',
  textClassName = '',
  iconClassName = '',
  theme = 'light',
}: LogoProps) {
  const { iconSize, fontSize, badgeSize, gap } = sizeConfig[size]
  const isDark = theme === 'dark'

  return (
    <div className={`inline-flex items-center ${gap} select-none ${className}`}>
      {/* Icon */}
      <div
        className={`relative flex items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-105 ${iconClassName}`}
        style={{
          width: iconSize,
          height: iconSize,
          background: 'linear-gradient(135deg, #1c90d8 0%, #1570a8 100%)',
          boxShadow: '0 4px 12px rgba(28, 144, 216, 0.28)',
        }}
      >
        <svg
          viewBox="0 0 512 512"
          width={iconSize * 0.72}
          height={iconSize * 0.72}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Play triangle */}
          <polygon points="170,130 170,382 382,256" fill="#ffffff" />
          {/* Star accent */}
          <circle cx="380" cy="130" r="46" fill="#fbbf24" />
          <polygon
            points="380,94 388,122 416,122 393,140 401,168 380,150 359,168 367,140 344,122 372,122"
            fill="#ffffff"
          />
        </svg>
      </div>

      {/* Wordmark */}
      {showText && (
        <div className="flex items-center gap-2">
          <span
            className={`font-black tracking-tight ${fontSize} ${
              textClassName || (isDark ? 'text-white' : 'text-gray-900')
            }`}
          >
            Nour<span style={{ color: '#1c90d8' }}>Play</span>
          </span>
          {subtitle && (
            <span
              className={`rounded-full font-semibold uppercase tracking-wider ${badgeSize} ${
                isDark
                  ? 'bg-sky-950 text-sky-400 border border-sky-800'
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
