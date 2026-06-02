'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { api, ComplianceStats } from '../../../lib/api'

const CONSENT_LABELS: Record<string, string> = {
  TERMS: 'CGU',
  PRIVACY: 'Politique de confidentialité',
  COOKIE_ANALYTICS: 'Cookies analytiques',
  COOKIE_FUNCTIONAL: 'Cookies fonctionnels',
  PARENTAL_CONSENT: 'Consentement parental',
}

const GDPR_TYPE_LABELS: Record<string, string> = {
  EXPORT: 'Export de données',
  DELETE: 'Suppression de compte',
  RECTIFICATION: 'Rectification',
}

const GDPR_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-400',
  PROCESSING: 'bg-blue-500/20 text-blue-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  REJECTED: 'bg-red-500/20 text-red-400',
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function CompliancePage() {
  const { token } = useAuth()
  const [stats, setStats] = useState<ComplianceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    api.admin.getComplianceStats(token)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          Erreur de chargement : {error ?? 'Données indisponibles'}
        </div>
      </div>
    )
  }

  const pendingGdpr = stats.gdpr.byStatus['PENDING'] ?? 0
  const processingGdpr = stats.gdpr.byStatus['PROCESSING'] ?? 0

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Conformité RGPD</h1>
        <p className="text-gray-500 text-sm mt-1">
          Vue d'ensemble des consentements et des demandes d'exercice des droits
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Consentements actifs" value={stats.consents.activeTotal} />
        <StatCard label="Consentements révoqués" value={stats.consents.revokedTotal} />
        <StatCard
          label="Demandes RGPD en attente"
          value={pendingGdpr + processingGdpr}
          sub={`${pendingGdpr} en attente · ${processingGdpr} en cours`}
        />
        <StatCard
          label="Demandes traitées"
          value={stats.gdpr.byStatus['COMPLETED'] ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consentements par type */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Consentements actifs par type
          </h2>
          {Object.entries(CONSENT_LABELS).map(([type, label]) => {
            const count = stats.consents.byType[type] ?? 0
            const total = stats.consents.activeTotal
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{label}</span>
                  <span className="text-gray-500">{count.toLocaleString('fr-FR')} ({pct}%)</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* RGPD — Demandes par type */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Demandes RGPD par type
          </h2>
          {Object.entries(GDPR_TYPE_LABELS).map(([type, label]) => {
            const count = stats.gdpr.byType[type] ?? 0
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{label}</span>
                <span className="text-lg font-bold text-white">{count}</span>
              </div>
            )
          })}
          <hr className="border-gray-700" />
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Par statut</p>
            {Object.entries(stats.gdpr.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GDPR_STATUS_COLORS[status] ?? 'bg-gray-700 text-gray-300'}`}>
                  {status}
                </span>
                <span className="text-gray-300 text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending GDPR requests */}
      {stats.gdpr.pendingRequests.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Demandes en attente de traitement</h2>
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold">
              {stats.gdpr.pendingRequests.length} demande{stats.gdpr.pendingRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Demandé le</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Délai légal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {stats.gdpr.pendingRequests.map(req => {
                const requested = new Date(req.requestedAt)
                const deadlineDays = 30
                const daysElapsed = Math.floor((Date.now() - requested.getTime()) / (1000 * 60 * 60 * 24))
                const daysLeft = deadlineDays - daysElapsed
                const urgent = daysLeft <= 7
                return (
                  <tr key={req.id} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{req.user.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-gray-300">{GDPR_TYPE_LABELS[req.type] ?? req.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${GDPR_STATUS_COLORS[req.status] ?? 'bg-gray-700 text-gray-300'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {requested.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {daysLeft > 0 ? (
                        <span className={urgent ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                          {daysLeft}j restants{urgent && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-red-500 font-semibold">Dépassé ({Math.abs(daysLeft)}j)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Compliance checklist */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Checklist de conformité RGPD
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: 'Consentements enregistrés avec IP hashée (SHA-256)', ok: true },
            { label: 'Versionnement des textes CGU/Politique', ok: true },
            { label: 'Droit à l\'export de données (art. 20)', ok: true },
            { label: 'Droit à la suppression (art. 17)', ok: true },
            { label: 'Journal d\'audit immuable (insert-only)', ok: true },
            { label: 'Soft delete avec conservation légale', ok: true },
            { label: 'Minimisation données enfants (birthYear only)', ok: true },
            { label: 'Délai légal de traitement ≤ 30 jours', ok: pendingGdpr === 0 },
            { label: 'Consentement parental double opt-in', ok: true },
            { label: 'DPO désigné et coordonnées visibles', ok: false },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3">
              <span className={`mt-0.5 text-base leading-none shrink-0 ${item.ok ? 'text-green-400' : 'text-red-400'}`}>
                {item.ok ? '✓' : '✗'}
              </span>
              <span className={`text-sm ${item.ok ? 'text-gray-300' : 'text-red-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
