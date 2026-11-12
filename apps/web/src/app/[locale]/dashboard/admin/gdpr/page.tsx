'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, GdprAdminStats, GdprAdminRequest } from '../../../../../lib/api'

const CONSENT_LABELS: Record<string, string> = {
  TERMS: 'CGU',
  PRIVACY: 'Confidentialité',
  COOKIE_ANALYTICS: 'Cookies analytiques',
  COOKIE_FUNCTIONAL: 'Cookies fonctionnels',
  PARENTAL_CONSENT: 'Consentement parental',
}

const TYPE_LABELS: Record<string, string> = {
  EXPORT: 'Export', DELETE: 'Suppression', RECTIFICATION: 'Rectification',
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', PROCESSING: 'En traitement', COMPLETED: 'Terminée', REJECTED: 'Rejetée',
}

const ALL_STATUSES = ['ALL', 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']
const ALL_TYPES = ['ALL', 'EXPORT', 'DELETE', 'RECTIFICATION']

export default function AdminGdprPage() {
  const locale = useLocale()
  const router = useRouter()
  const { token, user } = useAuth()

  const [stats, setStats] = useState<GdprAdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const [requests, setRequests] = useState<GdprAdminRequest[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [requestsLoading, setRequestsLoading] = useState(true)

  const [updating, setUpdating] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      router.replace(`/${locale}/dashboard`)
    }
  }, [user, locale, router])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadStats = useCallback(async () => {
    if (!token) return
    setStatsLoading(true)
    try { setStats(await api.gdpr.adminStats(token)) } catch { /* ignore */ } finally { setStatsLoading(false) }
  }, [token])

  const loadRequests = useCallback(async () => {
    if (!token) return
    setRequestsLoading(true)
    try {
      const data = await api.gdpr.adminListRequests(token, {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        page, limit: 50,
      })
      setRequests(data.items)
      setTotal(data.total)
      setPages(data.pages)
    } catch { /* ignore */ } finally { setRequestsLoading(false) }
  }, [token, statusFilter, typeFilter, page])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRequests() }, [loadRequests])

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!token) return
    setUpdating(id)
    try {
      const updated = await api.gdpr.adminUpdateRequest(token, id, { status })
      setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r))
      showToast('Statut mis à jour.')
      loadStats()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur de mise à jour.')
    } finally {
      setUpdating(null)
    }
  }

  if (!user) return null

  const pendingByType = stats ? ['EXPORT', 'DELETE', 'RECTIFICATION'].map(t => ({
    type: t,
    pending: stats.requests[t]?.['PENDING'] ?? 0,
    processing: stats.requests[t]?.['PROCESSING'] ?? 0,
  })) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord RGPD/CNIL</h1>
        <p className="text-sm text-gray-500 mt-0.5">Suivi des demandes et de la couverture des consentements.</p>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-28">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Utilisateurs</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
          </div>
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Demandes en attente</p>
            <p className="text-3xl font-bold text-amber-800 mt-1">{stats.pendingTotal}</p>
          </div>
          {pendingByType.map(({ type, pending, processing }) => (
            <div key={type} className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{TYPE_LABELS[type]}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{pending + processing}</p>
              <p className="text-xs text-gray-400 mt-0.5">{pending} en attente · {processing} en traitement</p>
            </div>
          ))}
        </div>
      )}

      {/* Consent coverage */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Couverture des consentements</h2>
            <p className="text-xs text-gray-400 mt-0.5">% d&apos;utilisateurs actifs ayant accordé chaque consentement.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Accordés</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Couverture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(stats.consentCoverage).map(([type, { active, total: tot, pct }]) => (
                <tr key={type} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{CONSENT_LABELS[type] ?? type}</td>
                  <td className="px-4 py-3 text-gray-600">{active} / {tot}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-32">
                        <div
                          className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-semibold ${pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Requests table */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? s === 'ALL' ? 'bg-gray-800 text-white border-gray-800'
                      : (STATUS_BADGE[s] ?? 'bg-gray-100 text-gray-600 border-gray-200')
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {s === 'ALL' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {ALL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1) }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  typeFilter === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t === 'ALL' ? 'Tous les types' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{total} demande{total !== 1 ? 's' : ''}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {requestsLoading ? (
            <div className="flex items-center justify-center h-36">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center py-12 text-sm text-gray-400">Aucune demande dans cette catégorie.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Utilisateur</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Demandée le</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-gray-800 font-medium truncate max-w-48">{r.user.email}</p>
                        <p className="text-xs text-gray-400 font-mono">{r.user.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{TYPE_LABELS[r.type] ?? r.type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-400">
                        {new Date(r.requestedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'PENDING' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'PROCESSING')}
                              disabled={updating === r.id}
                              className="h-7 px-3 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {updating === r.id ? '…' : 'En traitement'}
                            </button>
                          </div>
                        )}
                        {r.status === 'PROCESSING' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'COMPLETED')}
                              disabled={updating === r.id}
                              className="h-7 px-3 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {updating === r.id ? '…' : 'Marquer terminée'}
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(r.id, 'REJECTED')}
                              disabled={updating === r.id}
                              className="h-7 px-3 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                              Rejeter
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
