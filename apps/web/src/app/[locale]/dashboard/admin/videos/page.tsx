'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api } from '../../../../../lib/api'
import { RemoteImage } from '../../../../../components/RemoteImage'

type VideoItem = {
  id: string
  title: string
  thumbnailUrl: string | null
  validationStatus: string
  ageRating: string
  language: string | null
  createdAt: string
  submittedById: string | null
  source: { name: string; slug: string } | null
}

const STATUS_TABS = [
  { key: 'PENDING', label: 'En attente', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'NEEDS_REVIEW', label: 'À modérer', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { key: 'ALL', label: 'Toutes', color: 'text-gray-600 bg-gray-50 border-gray-200' },
  { key: 'APPROVED', label: 'Approuvées', color: 'text-green-600 bg-green-50 border-green-200' },
  { key: 'REJECTED', label: 'Rejetées', color: 'text-red-600 bg-red-50 border-red-200' },
]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  NEEDS_REVIEW: 'bg-orange-50 text-orange-700 border border-orange-200',
  APPROVED: 'bg-green-50 text-green-700 border border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', NEEDS_REVIEW: 'À modérer', APPROVED: 'Approuvée', REJECTED: 'Rejetée',
}

export default function AdminVideosPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token, user } = useAuth()

  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<VideoItem[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [applying, setApplying] = useState(false)
  const [toast, setToast] = useState('')

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      router.replace(`/${locale}/dashboard`)
    }
  }, [user, locale, router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setSelected(new Set())
    try {
      const data = await api.videos.adminQueue(token, { status: statusFilter, q: q || undefined, page, limit: 50 })
      setItems(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter, q, page])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleBulkApply = async () => {
    if (!token || !bulkAction || selected.size === 0) return
    setApplying(true)
    try {
      const { updated } = await api.videos.bulkUpdateStatus(token, Array.from(selected), bulkAction)
      showToast(`${updated} vidéo${updated !== 1 ? 's' : ''} ${bulkAction === 'APPROVE' ? 'approuvée' : 'rejetée'}${updated !== 1 ? 's' : ''}.`)
      setBulkAction(null)
      await load()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l\'action groupée.')
    } finally {
      setApplying(false)
    }
  }

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(i => i.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!user) return null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modération vidéos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} vidéo{total !== 1 ? 's' : ''} au total</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === tab.key ? tab.color : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="Rechercher par titre…"
          className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-700">{selected.size} sélectionnée{selected.size !== 1 ? 's' : ''}</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {bulkAction === 'REJECT' ? (
              <>
                <span className="text-sm text-gray-600">Rejeter {selected.size} vidéo{selected.size !== 1 ? 's' : ''} ?</span>
                <button
                  onClick={handleBulkApply}
                  disabled={applying}
                  className="h-8 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {applying ? '…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => setBulkAction(null)}
                  className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Annuler
                </button>
              </>
            ) : bulkAction === 'APPROVE' ? (
              <>
                <span className="text-sm text-gray-600">Approuver {selected.size} vidéo{selected.size !== 1 ? 's' : ''} ?</span>
                <button
                  onClick={handleBulkApply}
                  disabled={applying}
                  className="h-8 px-4 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {applying ? '…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => setBulkAction(null)}
                  className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setBulkAction('APPROVE')}
                  className="h-8 px-4 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approuver
                </button>
                <button
                  onClick={() => setBulkAction('REJECT')}
                  className="h-8 px-4 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  Rejeter
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="h-8 px-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Désélectionner
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Aucune vidéo dans cette catégorie.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < items.length }}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vidéo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Soumis par</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr
                  key={item.id}
                  className={`group transition-colors ${selected.has(item.id) ? 'bg-indigo-50/60' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-10 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                        {item.thumbnailUrl
                          ? <RemoteImage src={item.thumbnailUrl} alt="" fill className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-base">🎥</div>
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-64">{item.title}</p>
                        <p className="text-xs text-gray-400">{item.ageRating}{item.language ? ` · ${item.language.toUpperCase()}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{item.source?.name ?? '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-400 font-mono text-xs truncate max-w-36">{item.submittedById ? item.submittedById.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.validationStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[item.validationStatus] ?? item.validationStatus}
                    </span>
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
          <p className="text-sm text-gray-500">Page {page} / {pages}</p>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
