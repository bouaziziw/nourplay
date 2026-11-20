interface VideoCardProps {
  title: string
  thumbnailUrl?: string
  durationSec?: number
  language?: string
  ageRating?: string
  onClick?: () => void
  priority?: boolean
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VideoCard({
  title,
  thumbnailUrl,
  durationSec,
  language,
  ageRating,
  onClick,
}: VideoCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="group cursor-pointer rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-sky-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden flex flex-col"
      aria-label={title}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.876v6.248a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}

        {/* Hover overlay with modern play icon */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300"
            style={{ backgroundColor: '#1c90d8' }}
          >
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration badge */}
        {durationSec != null && (
          <span className="absolute bottom-2.5 right-2.5 rounded-lg bg-black/75 backdrop-blur-md px-2 py-0.5 text-[11px] font-semibold text-white tracking-wider shadow-sm">
            {formatDuration(durationSec)}
          </span>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <h3 className="line-clamp-2 text-sm font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug">
          {title}
        </h3>
        <div className="mt-2.5 flex items-center gap-2">
          {language && (
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 uppercase tracking-wider">
              {language}
            </span>
          )}
          {ageRating && (
            <span className="text-xs text-gray-500 font-medium">
              {ageRating}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
