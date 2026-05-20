interface ProfileAvatarProps {
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-2xl',
}

const colors = ['bg-violet-400', 'bg-sky-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400']

function getColor(name: string) {
  return colors[name.charCodeAt(0) % colors.length]
}

export function ProfileAvatar({ name, avatarUrl, size = 'md', onClick }: ProfileAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      className={[
        'flex items-center justify-center rounded-full font-bold text-white',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'transition-transform hover:scale-105',
        sizeClasses[size],
        avatarUrl ? '' : getColor(name),
      ].join(' ')}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        initials
      )}
    </button>
  )
}
