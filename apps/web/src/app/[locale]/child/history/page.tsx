'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { useChildSession } from '../../../../hooks/useChildSession'
import { api } from '../../../../lib/api'
import { RemoteImage } from '../../../../components/RemoteImage'

interface HistoryEntry {
  id: string
  watchedAt: string
  durationWatchedSec: number
  completed: boolean
  video: {
    id: string
    title: string
    thumbnailUrl?: string | null
    durationSec?: number | null
    embedUrl: string
  }
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m${s}s` : `${m} min`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `il y a ${hr}h`
  const days = Math.floor(hr / 24)
  if (days < 7) return `il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function ChildHistoryPage() {
  const { token } = useAuth()
  const { session } = useChildSession()
  const locale = useLocale()
  const router = useRouter()

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!token || !session?.profileId) return
    api.users.getWatchHistory(token, session.profileId, 50)
      .then(items => setHistory(items as HistoryEntry[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, session?.profileId])

  const handleClear = async () => {
    if (!token || !session?.profileId) return
    setClearing(true)
    try {
      await api.users.clearHistory(token, session.profileId)
      setHistory([])
      setConfirmClear(false)
    } catch {
      // ignore
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Historique</h1>
          {!loading && history.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{history.length} vidéo{history.length > 1 ? 's' : ''} regardée{history.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {history.length > 0 && !confirmClear && (
          <button
            onClick={() => setConfirmClear(true)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Tout effacer
          </button>
        )}

        {confirmClear && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Effacer tout ?</span>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {clearing ? 'En cours…' : 'Oui'}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📺</span>
          <p className="text-gray-500 font-medium">Aucune vidéo regardée pour l&apos;instant.</p>
          <button
            onClick={() => router.push(`/${locale}/child/playlists`)}
            className="mt-4 h-9 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Découvrir des vidéos
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(entry => {
            const progress = entry.video.durationSec
              ? Math.min(100, Math.round((entry.durationWatchedSec / entry.video.durationSec) * 100))
              : null

            return (
              <button
                key={entry.id}
                onClick={() => router.push(`/${locale}/child/watch/${entry.video.id}`)}
                className="w-full flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-sm hover:shadow-md hover:bg-white transition-all text-left group"
              >
                {/* Thumbnail */}
                <div className="relative w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100" style={{ paddingBottom: '42%' }}>
                  {entry.video.thumbnailUrl ? (
                    <RemoteImage
                      src={entry.video.thumbnailUrl}
                      alt={entry.video.title}
                      fill
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl">🎥</span>
                    </div>
                  )}

                  {/* Progress bar */}
                  {progress !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  {/* Completed badge */}
                  {entry.completed && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors leading-snug">
                    {entry.video.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{timeAgo(entry.watchedAt)}</span>
                    {entry.durationWatchedSec > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{formatDuration(entry.durationWatchedSec)}</span>
                      </>
                    )}
                  </div>
                </div>

                <svg
                  className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0 transition-colors"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
