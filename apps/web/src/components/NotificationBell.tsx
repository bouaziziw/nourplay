'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, Notification } from '../lib/api'
import { useWebPush } from '../hooks/useWebPush'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `il y a ${hr}h`
  return `il y a ${Math.floor(hr / 24)}j`
}

export function NotificationBell({ token }: { token: string }) {
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, isLoading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = useWebPush(token)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchUnread = useCallback(() => {
    api.notifications.list(token, { limit: 1 })
      .then(res => setUnread(res.unread))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    fetchUnread()
    const id = setInterval(fetchUnread, 60_000)
    return () => clearInterval(id)
  }, [fetchUnread])

  const openPanel = async () => {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await api.notifications.list(token, { limit: 10 })
      setNotifications(res.items)
      setUnread(res.unread)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(token, id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      setUnread(u => Math.max(0, u - 1))
    } catch {
      // ignore
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })))
      setUnread(0)
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.notifications.delete(token, id)
      const deleted = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (deleted && !deleted.readAt) setUnread(u => Math.max(0, u - 1))
    } catch {
      // ignore
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const notifBody = (n: { type: string; payload: Record<string, unknown> }): string | null => {
    const p = n.payload
    if (typeof p.message === 'string') return p.message
    switch (n.type) {
      case 'SCREEN_TIME_ALERT':
        return `${p.profileName} : ${p.watchedMin} min regardées (limite ${p.limitMin} min/jour)`
      case 'VIDEO_PUBLISHED':
        return `"${p.videoTitle}" vient d'être ajouté à la bibliothèque.`
      case 'VIDEO_APPROVED':
      case 'VIDEO_REJECTED':
        return typeof p.videoTitle === 'string' ? `"${p.videoTitle}"${p.reason ? ` — ${p.reason}` : ''}` : null
      case 'PLAYLIST_SHARED':
        return typeof p.playlistName === 'string' ? `"${p.playlistName}"` : null
      default:
        return null
    }
  }

  const typeLabel = (type: string): string => {
    const map: Record<string, string> = {
      VIDEO_APPROVED: 'Vidéo approuvée',
      VIDEO_REJECTED: 'Vidéo rejetée',
      VIDEO_PUBLISHED: 'Nouveau contenu disponible',
      PLAYLIST_SHARED: 'Playlist partagée',
      REPORT_RESOLVED: 'Signalement résolu',
      SCREEN_TIME_ALERT: 'Limite de temps atteinte',
      'subscription.expiring': 'Abonnement bientôt expiré',
    }
    return map[type] ?? type
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">Aucune notification.</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 ${!n.readAt ? 'bg-indigo-50/40' : ''}`}
                >
                  {!n.readAt && (
                    <span className="mt-1.5 w-2 h-2 flex-shrink-0 rounded-full bg-indigo-500" />
                  )}
                  {n.readAt && <span className="mt-1.5 w-2 h-2 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{typeLabel(n.type)}</p>
                    {notifBody(n) && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notifBody(n)}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1 mt-0.5">
                    {!n.readAt && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        title="Marquer comme lu"
                        className="text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      title="Supprimer"
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {pushSupported && (
            <div className="px-4 py-2.5 border-t border-gray-100">
              <button
                onClick={pushSubscribed ? pushUnsubscribe : pushSubscribe}
                disabled={pushLoading}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-indigo-600 disabled:opacity-50 transition-colors"
              >
                {pushLoading ? (
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                )}
                {pushSubscribed ? 'Désactiver les notifications navigateur' : 'Activer les notifications navigateur'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
