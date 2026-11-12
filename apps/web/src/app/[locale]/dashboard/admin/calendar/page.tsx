'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, ScheduledPlaylist } from '../../../../../lib/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function groupByDate(items: ScheduledPlaylist[]): [string, ScheduledPlaylist[]][] {
  const map = new Map<string, ScheduledPlaylist[]>()
  for (const item of items) {
    const key = new Date(item.scheduledPublishAt).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return Array.from(map.entries())
}

const AGE_LABEL: Record<string, string> = {
  AGE_0_3: '0–3', AGE_4_6: '4–6', AGE_7_9: '7–9', AGE_10_12: '10–12', AGE_13_15: '13–15',
}

export default function AdminCalendarPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token, user } = useAuth()

  const [items, setItems] = useState<ScheduledPlaylist[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      router.replace(`/${locale}/dashboard`)
    }
  }, [user, locale, router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      setItems(await api.playlists.listScheduled(token))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleCancel = async (id: string) => {
    if (!token) return
    try {
      await api.playlists.schedule(token, id, null)
      setItems(prev => prev.filter(p => p.id !== id))
      setToast('Publication annulée.')
      setTimeout(() => setToast(''), 3000)
    } catch {
      // ignore
    }
  }

  const groups = groupByDate(items)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier de publication</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {items.length} playlist{items.length !== 1 ? 's' : ''} programmée{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Actualiser
        </button>
      </div>

      {toast && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-700">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Aucune publication programmée.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, playlists]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide capitalize">
                  {date}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {playlists.map(pl => (
                  <div key={pl.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{pl.name}</p>
                        <span className="text-xs text-gray-400 font-mono">{formatDate(pl.scheduledPublishAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-gray-500">{pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}</span>
                        {pl.targetAgeGroup.length > 0 && (
                          <span className="text-xs text-indigo-600">
                            {pl.targetAgeGroup.map(g => AGE_LABEL[g] ?? g).join(', ')} ans
                          </span>
                        )}
                        <span className="text-xs text-gray-400 truncate">{pl.owner.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link
                        href={`/${locale}/dashboard/playlists/${pl.id}/edit`}
                        className="h-8 px-3 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors flex items-center"
                      >
                        Modifier
                      </Link>
                      <button
                        onClick={() => handleCancel(pl.id)}
                        className="h-8 px-3 border border-red-200 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
