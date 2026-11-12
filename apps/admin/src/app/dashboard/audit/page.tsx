'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { api, AuditLog } from '../../../lib/api'

const ACTION_COLORS: Record<string, string> = {
  USER_BANNED: 'bg-red-500/20 text-red-400',
  USER_ROLE_UPDATED: 'bg-amber-500/20 text-amber-400',
  VIDEO_APPROVED: 'bg-green-500/20 text-green-400',
  VIDEO_REJECTED: 'bg-red-500/20 text-red-400',
  REPORT_RESOLVED: 'bg-sky-500/20 text-sky-400',
}

export default function AuditPage() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const LIMIT = 30

  const load = useCallback((p = 1) => {
    if (!token) return
    setLoading(true)
    api.admin.getAuditLogs(token, {
      page: p,
      limit: LIMIT,
      action: action || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then(res => { setLogs(res.items); setTotal(res.total); setPage(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, action, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault()
    load(1)
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Journal d&apos;audit</h1>
        <p className="text-gray-500 text-sm mt-1">{total} entrée{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Action</label>
          <input
            type="text"
            value={action}
            onChange={e => setAction(e.target.value)}
            placeholder="ex: VIDEO_APPROVED"
            className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Du</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Au</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Filtrer
        </button>
        {(action || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setAction(''); setDateFrom(''); setDateTo('') }}
            className="h-9 px-3 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
          >
            Réinitialiser
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 bg-gray-800 border border-gray-700 rounded-xl">
          <p className="text-gray-400 text-sm">Aucune entrée trouvée.</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ressource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Acteur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-700/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-gray-700 text-gray-300'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    <span className="font-medium text-gray-300">{log.resourceType}</span>
                    {log.resourceId && (
                      <span className="text-xs text-gray-600 ml-1 font-mono">#{log.resourceId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {log.actor ? (
                      <span>{log.actor.email}</span>
                    ) : (
                      <span className="text-gray-600">Système</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {log.ip ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(log.occurredAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details>
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400 select-none">détails</summary>
                        <pre className="absolute z-10 mt-1 text-xs text-gray-300 bg-gray-900 border border-gray-700 rounded-lg p-2 max-w-xs overflow-auto max-h-32 shadow-xl">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
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
