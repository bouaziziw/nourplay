'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, AuditLogEntry } from '../../../../../lib/api'

const RESOURCE_TYPES = ['', 'User', 'Video', 'Playlist', 'LegalDocument', 'Subscription', 'Report']

const ACTION_COLORS: Record<string, string> = {
  'user.update':       'bg-blue-50 text-blue-700 border-blue-200',
  'video.approve':     'bg-green-50 text-green-700 border-green-200',
  'video.reject':      'bg-red-50 text-red-700 border-red-200',
  'report.resolve':    'bg-amber-50 text-amber-700 border-amber-200',
  'legal.create':      'bg-purple-50 text-purple-700 border-purple-200',
  'legal.publish':     'bg-indigo-50 text-indigo-700 border-indigo-200',
  'subscription.grant':  'bg-teal-50 text-teal-700 border-teal-200',
  'subscription.revoke': 'bg-orange-50 text-orange-700 border-orange-200',
}

function actionBadgeClass(action: string) {
  return ACTION_COLORS[action] ?? 'bg-gray-50 text-gray-600 border-gray-200'
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
}

function MetadataCell({ data }: { data: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false)
  if (!data || Object.keys(data).length === 0) return <span className="text-gray-300">—</span>
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
      >
        {open ? 'Masquer' : 'Voir'}
      </button>
      {open && (
        <div className="absolute z-10 left-0 top-full mt-1 min-w-48 max-w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </div>
      )}
    </div>
  )
}

export default function AdminAuditLogsPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token, user } = useAuth()

  const [items, setItems] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [filterAction, setFilterAction] = useState('')
  const [filterResource, setFilterResource] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LIMIT = 50
  const pages = Math.max(1, Math.ceil(total / LIMIT))

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      router.replace(`/${locale}/dashboard`)
    }
  }, [user, locale, router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await api.admin.getAuditLogs(token, {
        page,
        limit: LIMIT,
        ...(filterAction && { action: filterAction }),
        ...(filterResource && { resourceType: filterResource }),
        ...(filterDateFrom && { dateFrom: new Date(filterDateFrom).toISOString() }),
        ...(filterDateTo && { dateTo: new Date(filterDateTo + 'T23:59:59').toISOString() }),
      })
      setItems(data.items)
      setTotal(data.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, page, filterAction, filterResource, filterDateFrom, filterDateTo])

  useEffect(() => { load() }, [load])

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setter(e.target.value)
    setPage(1)
  }

  if (!user) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal d&apos;audit</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString('fr-FR')} entrée{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => load()}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <input
          type="text"
          value={filterAction}
          onChange={handleFilterChange(setFilterAction)}
          placeholder="Action (ex: video.approve)"
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={filterResource}
          onChange={handleFilterChange(setFilterResource)}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          <option value="">Toutes les ressources</option>
          {RESOURCE_TYPES.filter(Boolean).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={handleFilterChange(setFilterDateFrom)}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={handleFilterChange(setFilterDateTo)}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Aucune entrée ne correspond à ces filtres.
          </div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Horodatage</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Acteur</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Ressource</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">ID ressource</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden xl:table-cell">Métadonnées</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden xl:table-cell">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap font-mono">
                    {fmt(entry.occurredAt)}
                  </td>
                  <td className="px-4 py-3">
                    {entry.actor ? (
                      <div>
                        <p className="text-xs font-medium text-gray-900 truncate max-w-36">{entry.actor.email}</p>
                        <p className="text-xs text-gray-400">{entry.actor.role}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Système</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${actionBadgeClass(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                    {entry.resourceType}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-400 font-mono">
                      {entry.resourceId ? entry.resourceId.slice(0, 8) + '…' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <MetadataCell data={entry.metadata} />
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell text-gray-400 text-xs font-mono">
                    {entry.ip ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} / {pages} — {total.toLocaleString('fr-FR')} entrées
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="h-8 px-3 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
