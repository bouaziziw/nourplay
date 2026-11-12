'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../../hooks/useAuth'
import { api, VideoReport } from '../../../../lib/api'
import { RemoteImage } from '../../../../components/RemoteImage'

export default function ReportsPage() {
  const { token } = useAuth()
  const [reports, setReports] = useState<VideoReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const LIMIT = 20

  const load = useCallback((p = 1, resolved = showResolved) => {
    if (!token) return
    setLoading(true)
    api.moderation.getReports(token, { page: p, limit: LIMIT, resolved })
      .then(res => { setReports(res.items); setTotal(res.total); setPage(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, showResolved])

  useEffect(() => { load() }, [load])

  const toggleResolved = () => {
    const next = !showResolved
    setShowResolved(next)
    load(1, next)
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signalements</h1>
          <p className="text-gray-500 text-sm mt-1">{total} signalement{total !== 1 ? 's' : ''} {showResolved ? 'résolus' : 'en attente'}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleResolved}
            className="h-9 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
          >
            {showResolved ? 'Voir en attente' : 'Voir résolus'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 bg-gray-800 border border-gray-700 rounded-xl">
          <p className="text-4xl mb-4">✓</p>
          <p className="text-gray-400 text-sm">Aucun signalement {showResolved ? 'résolu' : 'en attente'}.</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Vidéo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Motif</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Signalé par</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {r.video.thumbnailUrl && (
                        <RemoteImage src={r.video.thumbnailUrl} alt="" width={40} height={28} className="w-10 h-7 rounded object-cover flex-shrink-0" />
                      )}
                      <span className="text-gray-200 line-clamp-1">{r.video.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs">
                    <span className="line-clamp-1">{r.reason}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{r.reporter.email}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    {r.resolved
                      ? <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Résolu</span>
                      : <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">En attente</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/moderation/reports/${r.id}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">← Précédent</button>
          <span className="text-sm text-gray-500">Page {page} / {pages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= pages} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">Suivant →</button>
        </div>
      )}
    </div>
  )
}
