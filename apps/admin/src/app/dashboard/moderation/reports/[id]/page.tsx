'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../../hooks/useAuth'
import { api, VideoReport } from '../../../../../lib/api'

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token } = useAuth()
  const [report, setReport] = useState<VideoReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (!token) return
    api.moderation.getReport(token, id)
      .then(r => { setReport(r); setResolved(r.resolved) })
      .catch(() => router.replace('/dashboard/moderation/reports'))
      .finally(() => setLoading(false))
  }, [token, id, router])

  const handleResolve = async () => {
    if (!token) return
    setResolving(true)
    try {
      const updated = await api.moderation.resolveReport(token, id, notes.trim() || undefined)
      setReport(updated)
      setResolved(true)
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-white">Signalement</h1>
        {resolved
          ? <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-medium">Résolu</span>
          : <span className="ml-2 text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-medium">En attente</span>
        }
      </div>

      {/* Video info */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Vidéo signalée</h2>
        <div className="flex gap-4">
          {report.video.thumbnailUrl && (
            <img src={report.video.thumbnailUrl} alt="" className="w-32 aspect-video object-cover rounded-lg flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-white">{report.video.title}</p>
            <p className="text-xs text-gray-500 mt-1">ID: {report.video.id}</p>
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
              report.video.validationStatus === 'APPROVED' ? 'bg-green-500/20 text-green-400'
              : report.video.validationStatus === 'REJECTED' ? 'bg-red-500/20 text-red-400'
              : 'bg-amber-500/20 text-amber-400'
            }`}>
              {report.video.validationStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Report details */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Détails du signalement</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs mb-1">Signalé par</p>
            <p className="text-gray-200">{report.reporter.email}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Date</p>
            <p className="text-gray-200">
              {new Date(report.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div>
          <p className="text-gray-500 text-xs mb-1">Motif</p>
          <p className="text-gray-200 text-sm">{report.reason}</p>
        </div>
        {report.description && (
          <div>
            <p className="text-gray-500 text-xs mb-1">Description</p>
            <p className="text-gray-300 text-sm leading-relaxed">{report.description}</p>
          </div>
        )}
        {resolved && report.resolvedAt && (
          <div>
            <p className="text-gray-500 text-xs mb-1">Résolu le</p>
            <p className="text-gray-300 text-sm">
              {new Date(report.resolvedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>

      {/* Resolve action */}
      {!resolved && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Résoudre le signalement</h2>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes de résolution (optionnel)…"
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
          >
            {resolving ? 'En cours…' : 'Marquer comme résolu'}
          </button>
        </div>
      )}
    </div>
  )
}
