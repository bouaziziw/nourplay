'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ParentalApprovalRequest, VideoSubmission } from '../../../../lib/api'
import { RemoteImage } from '../../../../components/RemoteImage'

const AGE_RATING_LABELS: Record<string, string> = {
  ALL: 'Tous publics',
  AGE_4_PLUS: '4 ans et +',
  AGE_7_PLUS: '7 ans et +',
  AGE_10_PLUS: '10 ans et +',
  AGE_13_PLUS: '13 ans et +',
}

const STATUS_TABS = [
  { key: 'PENDING', label: 'En attente' },
  { key: 'ALL', label: 'Tout l\'historique' },
  { key: 'APPROVED', label: 'Approuvées' },
  { key: 'DENIED', label: 'Refusées' },
]

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  DENIED: 'bg-red-50 text-red-700 border-red-200',
}
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', APPROVED: 'Approuvée', DENIED: 'Refusée',
}

export default function ApprovalsPage() {
  const { token, user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [requests, setRequests] = useState<ParentalApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')
  const [approvingSubmission, setApprovingSubmission] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await api.approvals.list(token, statusFilter !== 'ALL' ? statusFilter : undefined)
      setRequests(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [token, statusFilter])

  useEffect(() => { load() }, [load])

  const loadSubmissions = useCallback(async () => {
    if (!token || !['PARENT', 'TEACHER'].includes(user?.role ?? '')) return
    setSubmissionsLoading(true)
    setSubmissionsError('')
    try {
      setSubmissions(await api.videos.mySubmissions(token))
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Impossible de charger vos vidéos.')
    } finally {
      setSubmissionsLoading(false)
    }
  }, [token, user?.role])

  useEffect(() => { loadSubmissions() }, [loadSubmissions])

  useEffect(() => {
    const hasPendingValidation = submissions.some(
      video => video.validationStatus === 'PENDING',
    )
    if (!hasPendingValidation) return

    const interval = setInterval(() => { void loadSubmissions() }, 3000)
    return () => clearInterval(interval)
  }, [submissions, loadSubmissions])

  const handleApproveSubmission = async (videoId: string) => {
    if (!token) return
    setApprovingSubmission(videoId)
    setSubmissionsError('')
    try {
      const updated = await api.videos.approveSubmission(token, videoId)
      setSubmissions(items => items.map(video =>
        video.id === videoId ? { ...video, ...updated } : video,
      ))
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Impossible de valider cette vidéo.')
    } finally {
      setApprovingSubmission(null)
    }
  }

  const handleResolve = async (requestId: string, action: 'APPROVED' | 'DENIED') => {
    if (!token) return
    setResolving(requestId)
    try {
      const updated = await api.approvals.resolve(token, requestId, action)
      setRequests(prev => prev.map(r => r.id === requestId ? updated : r).filter(r =>
        statusFilter === 'ALL' || statusFilter === 'PENDING' ? true : r.status === statusFilter
      ))
      if (statusFilter === 'PENDING') {
        setRequests(prev => prev.filter(r => r.id !== requestId))
      }
      showToast(action === 'APPROVED' ? 'Vidéo autorisée.' : 'Demande refusée.')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la résolution.')
    } finally {
      setResolving(null)
    }
  }

  const pendingCount = requests.filter(r => r.status === 'PENDING').length

  return (
    <div className="w-full space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Approbations</h1>
          {pendingCount > 0 && statusFilter !== 'PENDING' && (
            <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 bg-amber-500 text-white text-xs font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          Suivez la validation de vos vidéos ajoutées ou répondez aux demandes de vos enfants.
        </p>
      </div>

      {['PARENT', 'TEACHER'].includes(user?.role ?? '') && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Vidéos que j&apos;ai ajoutées</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Chaque vidéo est envoyée automatiquement en validation dès sa soumission.
              </p>
            </div>
            <button
              type="button"
              onClick={loadSubmissions}
              disabled={submissionsLoading}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            >
              Actualiser
            </button>
          </div>
          {submissionsError && <p role="alert" className="text-sm text-red-600">{submissionsError}</p>}
          {submissionsLoading ? (
            <p className="text-sm text-gray-500">Chargement des vidéos…</p>
          ) : submissions.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              Aucune vidéo ajoutée par votre compte.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {submissions.map(video => (
                <li key={video.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {video.thumbnailUrl ? (
                    <RemoteImage src={video.thumbnailUrl} alt="" width={80} height={48} className="h-12 w-20 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-20 items-center justify-center rounded-lg bg-gray-100">🎥</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{video.title}</p>
                    <p className="text-xs text-gray-500">
                      {video.validationStatus === 'PENDING'
                        ? 'Contrôle automatique en cours'
                        : video.validationStatus === 'NEEDS_REVIEW' ? 'En attente d’un modérateur'
                          : video.validationStatus === 'APPROVED' ? 'Approuvée par le système'
                            : 'Refusée par le système'}
                    </p>
                  </div>
                  {video.validationStatus === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleApproveSubmission(video.id)}
                      disabled={approvingSubmission === video.id}
                      className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {approvingSubmission === video.id ? 'Relance…' : 'Relancer le contrôle'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Demandes de vos enfants</h2>
        <p className="text-sm text-gray-500">
          Autorisez ou refusez les demandes de visionnage de vos enfants.
        </p>
      </section>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === tab.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-36">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 text-sm">
            {statusFilter === 'PENDING' ? 'Aucune demande en attente.' : 'Aucune demande dans cette catégorie.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4"
            >
              {/* Thumbnail */}
              <div className="relative w-20 h-14 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                {req.video.thumbnailUrl ? (
                  <RemoteImage src={req.video.thumbnailUrl} alt="" fill className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🎥</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{req.video.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {req.profile.displayName}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-amber-600 font-medium">
                    {AGE_RATING_LABELS[req.video.ageRating] ?? req.video.ageRating}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    {new Date(req.requestedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>

              {/* Actions / Status */}
              <div className="flex-shrink-0">
                {req.status === 'PENDING' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResolve(req.id, 'APPROVED')}
                      disabled={resolving === req.id}
                      className="h-8 px-3 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {resolving === req.id ? '…' : 'Autoriser'}
                    </button>
                    <button
                      onClick={() => handleResolve(req.id, 'DENIED')}
                      disabled={resolving === req.id}
                      className="h-8 px-3 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                ) : (
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_BADGE[req.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {STATUS_LABELS[req.status] ?? req.status}
                  </span>
                )}
              </div>
            </div>
          ))}
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
