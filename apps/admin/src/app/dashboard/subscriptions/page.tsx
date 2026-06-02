'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { api, ApiError, AdminSubscription, SubscriptionStats, SubscriptionPlan } from '../../../lib/api'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/20 text-green-400',
  TRIALING: 'bg-blue-500/20 text-blue-400',
  PAST_DUE: 'bg-yellow-500/20 text-yellow-400',
  CANCELLED: 'bg-gray-500/20 text-gray-400',
  EXPIRED: 'bg-red-500/20 text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif', TRIALING: 'Essai', PAST_DUE: 'En retard',
  CANCELLED: 'Annulé', EXPIRED: 'Expiré',
}

const STATUS_OPTIONS = ['', 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'EXPIRED']

export default function SubscriptionsPage() {
  const { token } = useAuth()
  const [subs, setSubs] = useState<AdminSubscription[]>([])
  const [stats, setStats] = useState<SubscriptionStats | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Grant modal state
  const [showGrant, setShowGrant] = useState(false)
  const [grantUserId, setGrantUserId] = useState('')
  const [grantPlanId, setGrantPlanId] = useState('')
  const [grantExpiry, setGrantExpiry] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  const limit = 20

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [subsRes, statsRes] = await Promise.all([
        api.admin.getSubscriptions(token, { page, limit, ...(statusFilter && { status: statusFilter }) }),
        api.admin.getSubscriptionStats(token),
      ])
      setSubs(subsRes.items)
      setTotal(subsRes.total)
      setStats(statsRes)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [token, page, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!token) return
    api.admin.getPlans(token).then(setPlans).catch(() => {})
  }, [token])

  const handleRevoke = async (id: string) => {
    if (!token || !confirm('Révoquer cet abonnement ?')) return
    try {
      await api.admin.revokeSubscription(token, id)
      load()
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Erreur')
    }
  }

  const handleGrant = async () => {
    if (!token || !grantUserId || !grantPlanId) return
    setGranting(true)
    setGrantError(null)
    try {
      await api.admin.grantSubscription(token, {
        userId: grantUserId,
        planId: grantPlanId,
        ...(grantExpiry && { expiresAt: new Date(grantExpiry).toISOString() }),
      })
      setShowGrant(false)
      setGrantUserId('')
      setGrantPlanId('')
      setGrantExpiry('')
      load()
    } catch (e) {
      setGrantError(e instanceof ApiError ? e.message : 'Erreur')
    } finally {
      setGranting(false)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Abonnements</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} abonnement{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => setShowGrant(true)}
          className="h-9 px-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          + Attribuer
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED'].map(s => (
            <div key={s} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-1">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold text-white">{stats.byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Plans breakdown */}
      {stats && Object.keys(stats.byPlan).length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Par plan</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.byPlan).map(([name, count]) => (
              <div key={name} className="text-center">
                <p className="text-lg font-bold text-white">{count}</p>
                <p className="text-xs text-gray-500">{name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="h-9 px-3 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Utilisateur</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Début</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Expire</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800 animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : subs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">
                  Aucun abonnement trouvé
                </td>
              </tr>
            ) : (
              subs.map(sub => (
                <tr key={sub.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-gray-200 font-medium truncate max-w-48">{sub.user.email}</p>
                    <p className="text-xs text-gray-500">{sub.user.role}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{sub.plan.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] ?? 'bg-gray-500/20 text-gray-400'}`}>
                      {STATUS_LABELS[sub.status] ?? sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(sub.startedAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${sub.externalId ? 'text-indigo-400' : 'text-gray-500'}`}>
                      {sub.externalId ? 'Stripe' : 'Manuel'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {sub.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleRevoke(sub.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-sm">
            <span className="text-gray-500">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} sur {total}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Préc.
              </button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1 text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Suiv. →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grant modal */}
      {showGrant && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowGrant(false)}>
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">Attribuer un abonnement</h2>

            {grantError && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded px-3 py-2">{grantError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">UUID utilisateur</label>
                <input
                  type="text"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={grantUserId}
                  onChange={e => setGrantUserId(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Plan</label>
                <select
                  value={grantPlanId}
                  onChange={e => setGrantPlanId(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Choisir un plan…</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.priceEur === 0 ? 'Gratuit' : `${(p.priceEur / 100).toFixed(2)} €/${p.interval === 'MONTHLY' ? 'mois' : 'an'}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Date d'expiration (optionnel)</label>
                <input
                  type="date"
                  value={grantExpiry}
                  onChange={e => setGrantExpiry(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowGrant(false)}
                className="flex-1 h-9 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleGrant}
                disabled={granting || !grantUserId || !grantPlanId}
                className="flex-1 h-9 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {granting ? 'Attribution…' : 'Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
