'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../hooks/useAuth'
import { api, QueueVideo } from '../../../lib/api'
import { RemoteImage } from '../../../components/RemoteImage'

const AGE_RATING_COLORS: Record<string, string> = {
  ALL: 'bg-green-500/20 text-green-400',
  AGE_4_PLUS: 'bg-sky-500/20 text-sky-400',
  AGE_7_PLUS: 'bg-indigo-500/20 text-indigo-400',
  AGE_10_PLUS: 'bg-amber-500/20 text-amber-400',
  AGE_13_PLUS: 'bg-orange-500/20 text-orange-400',
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

function VideoCard({
  video,
  onReview,
  onDelete,
  canDelete,
}: {
  video: QueueVideo
  onReview: (id: string, action: 'approve' | 'reject', reason?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  canDelete: boolean
}) {
  const [acting, setActing] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<'approved' | 'rejected' | 'deleted' | null>(null)
  const [actionError, setActionError] = useState('')

  const handleApprove = async () => {
    setActing(true)
    setActionError('')
    try {
      await onReview(video.id, 'approve')
      setDone('approved')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible d’approuver la vidéo.')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) return
    setActing(true)
    setActionError('')
    try {
      await onReview(video.id, 'reject', reason.trim())
      setDone('rejected')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de rejeter la vidéo.')
    } finally {
      setActing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer définitivement « ${video.title} » et ses données associées ?`)) return
    setActing(true)
    setActionError('')
    try {
      await onDelete(video.id)
      setDone('deleted')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de supprimer la vidéo.')
    } finally {
      setActing(false)
    }
  }

  if (done) {
    return (
      <div className={`rounded-xl border p-4 flex items-center gap-3 ${done === 'approved' ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
        <span className="text-xl">{done === 'approved' ? '✓' : '✗'}</span>
        <div>
          <p className="font-medium text-sm text-gray-200">{video.title}</p>
          <p className={`text-xs mt-0.5 ${done === 'approved' ? 'text-green-400' : 'text-red-400'}`}>
            {done === 'approved' ? 'Approuvée' : done === 'deleted' ? 'Supprimée définitivement' : 'Rejetée'}
          </p>
        </div>
      </div>
    )
  }

  const score = video.validationScore
  const scoreColor = score == null ? 'text-gray-500' : score >= 0.7 ? 'text-green-400' : score >= 0.4 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Thumbnail + meta */}
      <div className="flex gap-4 p-4">
        <div className="w-40 aspect-video flex-shrink-0 bg-gray-700 rounded-lg overflow-hidden relative">
          {video.thumbnailUrl
            ? <RemoteImage src={video.thumbnailUrl} alt="" fill className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl">🎥</div>
          }
          {video.durationSec && (
            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(video.durationSec)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">{video.title}</h3>
          {video.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{video.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {video.source && (
              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{video.source.name}</span>
            )}
            {video.language && (
              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full uppercase">{video.language}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AGE_RATING_COLORS[video.ageRating] ?? 'bg-gray-700 text-gray-300'}`}>
              {video.ageRating.replace('_', '+')}
            </span>
            {score != null && (
              <span className={`text-xs font-mono font-bold ${scoreColor}`}>
                Score: {(score * 100).toFixed(0)}%
              </span>
            )}
          </div>
          {video.validationLog && Object.keys(video.validationLog).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Détails validation IA</summary>
              <pre className="mt-1 text-xs text-gray-400 bg-gray-900 rounded p-2 overflow-auto max-h-24">
                {JSON.stringify(video.validationLog, null, 2)}
              </pre>
            </details>
          )}
          <p className="text-xs text-gray-600 mt-2">
            Soumise le {new Date(video.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Embed preview link */}
      <div className="px-4 pb-2">
        <a href={video.embedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300 underline">
          Voir la vidéo →
        </a>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-700 px-4 py-3">
        {actionError && (
          <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {actionError}
          </p>
        )}
        {showReject ? (
          <div className="space-y-2">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Motif du rejet (obligatoire)…"
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={acting || !reason.trim()}
                className="h-8 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                {acting ? '…' : 'Confirmer le rejet'}
              </button>
              <button
                onClick={() => { setShowReject(false); setReason('') }}
                className="h-8 px-3 text-xs text-gray-400 hover:text-gray-200 border border-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={acting}
              className="h-8 px-4 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {acting ? '…' : '✓ Approuver'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={acting}
              className="h-8 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-semibold rounded-lg border border-red-500/30 disabled:opacity-50 transition-colors"
            >
              ✗ Rejeter
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={acting}
                className="h-8 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-semibold rounded-lg border border-gray-600 disabled:opacity-50 transition-colors"
              >
                Supprimer définitivement
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ModerationQueuePage() {
  const { token, user } = useAuth()
  const [videos, setVideos] = useState<QueueVideo[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [revalidating, setRevalidating] = useState(false)
  const [revalidationResult, setRevalidationResult] = useState('')
  const LIMIT = 10

  const load = useCallback((p = 1) => {
    if (!token) return
    setLoading(true)
    setQueueError('')
    api.moderation.getQueue(token, { page: p, limit: LIMIT })
      .then(res => { setVideos(res.items); setTotal(res.total); setPage(p) })
      .catch(error => {
        setQueueError(error instanceof Error ? error.message : 'Impossible de charger la file de modération.')
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  const handleReview = async (videoId: string, action: 'approve' | 'reject', reason?: string) => {
    if (!token) return
    await api.moderation.reviewVideo(token, videoId, { action, reason })
    setTotal(t => Math.max(0, t - 1))
  }

  const handleDelete = async (videoId: string) => {
    if (!token) return
    await api.moderation.deleteVideo(token, videoId)
    setVideos(items => items.filter(video => video.id !== videoId))
    setTotal(count => Math.max(0, count - 1))
  }

  const handleRevalidateAllPending = async () => {
    if (!token || !window.confirm('Relancer en priorité la validation automatique de toutes les vidéos en attente ?')) return
    setRevalidating(true)
    setQueueError('')
    setRevalidationResult('')
    try {
      const { queued } = await api.moderation.revalidateAllPending(token)
      setRevalidationResult(`${queued} vidéo${queued === 1 ? '' : 's'} envoyée${queued === 1 ? '' : 's'} en validation prioritaire.`)
      load(page)
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : 'Impossible de relancer les validations automatiques.')
    } finally {
      setRevalidating(false)
    }
  }

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">File de modération</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} vidéo{total !== 1 ? 's' : ''} en attente de validation automatique ou de révision manuelle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'ADMIN' && (
            <button
              onClick={handleRevalidateAllPending}
              disabled={revalidating}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {revalidating ? 'Relance…' : 'Relancer toutes les validations'}
            </button>
          )}
          <button onClick={() => load(page)} className="h-9 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      {revalidationResult && (
        <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {revalidationResult}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 bg-gray-800 border border-gray-700 rounded-xl">
          <p className="text-4xl mb-4">✓</p>
          <p className="text-gray-400 text-sm">File vide — aucune vidéo en attente.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              onReview={handleReview}
              onDelete={handleDelete}
              canDelete={user?.role === 'ADMIN'}
            />
          ))}
        </div>
      )}

      {queueError && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {queueError}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 justify-center">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
            ← Précédent
          </button>
          <span className="text-sm text-gray-500">Page {page} / {pages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= pages} className="h-9 px-4 bg-gray-700 disabled:opacity-40 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors">
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
