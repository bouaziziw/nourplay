'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../../hooks/useAuth'
import { api, GdprRequest, ConsentRecord } from '../../../../lib/api'

const CONSENT_LABELS: Record<string, string> = {
  TERMS: 'Conditions d\'utilisation',
  PRIVACY: 'Politique de confidentialité',
  COOKIE_ANALYTICS: 'Cookies analytiques',
  COOKIE_FUNCTIONAL: 'Cookies fonctionnels',
  PARENTAL_CONSENT: 'Consentement parental',
}

const CONSENT_VERSION = '2026-01-01'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  EXPORT: 'Export de données',
  DELETE: 'Suppression de compte',
  RECTIFICATION: 'Rectification',
}

const REQUEST_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
}
const REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', PROCESSING: 'En traitement', COMPLETED: 'Terminée', REJECTED: 'Rejetée',
}

type Tab = 'consents' | 'requests'

export default function PrivacyPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('consents')

  // Consents
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [consentsLoading, setConsentsLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [granting, setGranting] = useState<string | null>(null)

  // Requests
  const [requests, setRequests] = useState<GdprRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)

  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const loadConsents = useCallback(async () => {
    if (!token) return
    setConsentsLoading(true)
    try {
      setConsents(await api.consent.current(token))
    } catch { /* ignore */ } finally {
      setConsentsLoading(false)
    }
  }, [token])

  const loadRequests = useCallback(async () => {
    if (!token) return
    setRequestsLoading(true)
    try {
      setRequests(await api.gdpr.myRequests(token))
    } catch { /* ignore */ } finally {
      setRequestsLoading(false)
    }
  }, [token])

  useEffect(() => { loadConsents() }, [loadConsents])
  useEffect(() => { if (tab === 'requests') loadRequests() }, [tab, loadRequests])

  const handleRevoke = async (type: string) => {
    if (!token) return
    setRevoking(type)
    try {
      await api.consent.revoke(token, type)
      setConsents(prev => prev.filter(c => c.type !== type))
      showToast(`Consentement « ${CONSENT_LABELS[type] ?? type} » révoqué.`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur de révocation.')
    } finally {
      setRevoking(null)
    }
  }

  const handleGrant = async (type: string) => {
    if (!token) return
    setGranting(type)
    try {
      const record = await api.consent.record(token, { type, version: CONSENT_VERSION })
      setConsents(prev => [record, ...prev.filter(c => c.type !== type)])
      showToast(`Consentement « ${CONSENT_LABELS[type] ?? type} » enregistré.`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur d\'enregistrement.')
    } finally {
      setGranting(null)
    }
  }

  const handleRequestExport = async () => {
    if (!token) return
    setRequesting('EXPORT')
    try {
      const req = await api.gdpr.requestExport(token)
      setRequests(prev => [req, ...prev])
      showToast('Demande d\'export enregistrée. Vous recevrez un lien par email.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la demande.')
    } finally {
      setRequesting(null)
    }
  }

  const handleRequestDeletion = async () => {
    if (!token) return
    if (!confirm('Demander la suppression de votre compte ? Cette action est irréversible après traitement.')) return
    setRequesting('DELETE')
    try {
      const req = await api.gdpr.requestDeletion(token)
      setRequests(prev => [req, ...prev])
      showToast('Demande de suppression enregistrée.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la demande.')
    } finally {
      setRequesting(null)
    }
  }

  const activeTypes = new Set(consents.map(c => c.type))
  const missingTypes = Object.keys(CONSENT_LABELS).filter(t => !activeTypes.has(t))

  const hasPendingExport = requests.some(r => r.type === 'EXPORT' && (r.status === 'PENDING' || r.status === 'PROCESSING'))
  const hasPendingDelete = requests.some(r => r.type === 'DELETE' && (r.status === 'PENDING' || r.status === 'PROCESSING'))

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Confidentialité & RGPD</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez vos consentements et exercez vos droits sur vos données personnelles.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['consents', 'Mes consentements'], ['requests', 'Mes demandes RGPD']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Consents tab */}
      {tab === 'consents' && (
        <div className="space-y-4">
          {/* Active consents */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Consentements actifs</h2>
              <p className="text-xs text-gray-400 mt-0.5">Vous pouvez révoquer un consentement à tout moment.</p>
            </div>
            {consentsLoading ? (
              <div className="flex items-center justify-center h-28">
                <div className="animate-spin h-6 w-6 border-4 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            ) : consents.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">Aucun consentement actif.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {consents.map(c => (
                  <li key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{CONSENT_LABELS[c.type] ?? c.type}</p>
                      <p className="text-xs text-gray-400">
                        Version {c.version} · accordé le {new Date(c.consentedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(c.type)}
                      disabled={revoking === c.type}
                      className="h-7 px-3 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {revoking === c.type ? '…' : 'Révoquer'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Missing consents */}
          {!consentsLoading && missingTypes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Consentements non accordés</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                {missingTypes.map(type => (
                  <li key={type} className="flex items-center justify-between px-5 py-3">
                    <p className="text-sm text-gray-600">{CONSENT_LABELS[type]}</p>
                    <button
                      onClick={() => handleGrant(type)}
                      disabled={granting === type}
                      className="h-7 px-3 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                    >
                      {granting === type ? '…' : 'Accorder'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleRequestExport}
              disabled={!!requesting || hasPendingExport}
              className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {requesting === 'EXPORT' ? 'Demande en cours…' : hasPendingExport ? 'Export en cours' : 'Demander un export'}
            </button>
            <button
              onClick={handleRequestDeletion}
              disabled={!!requesting || hasPendingDelete}
              className="h-9 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {requesting === 'DELETE' ? 'Demande en cours…' : hasPendingDelete ? 'Suppression en cours' : 'Demander la suppression'}
            </button>
          </div>

          {/* Requests list */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {requestsLoading ? (
              <div className="flex items-center justify-center h-28">
                <div className="animate-spin h-6 w-6 border-4 border-indigo-600 border-t-transparent rounded-full" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-center py-10 text-sm text-gray-400">Aucune demande RGPD.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Statut</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Demandée le</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Traitée le</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${REQUEST_STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-gray-400">
                        {new Date(r.requestedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
                        {r.processedAt ? new Date(r.processedAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Les demandes d&apos;export et de suppression sont traitées dans un délai de 30 jours conformément au RGPD (art. 12).
          </p>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
