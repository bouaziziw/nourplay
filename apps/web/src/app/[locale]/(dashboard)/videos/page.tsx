'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, VideoSearchResult, ApiError } from '../../../../lib/api'
import { AddToPlaylistModal } from '../../../../components/AddToPlaylistModal'

const AGE_RATINGS = [
  { value: '', label: 'Tous' },
  { value: 'ALL', label: 'Tous publics' },
  { value: 'AGE_4_PLUS', label: '4+' },
  { value: 'AGE_7_PLUS', label: '7+' },
  { value: 'AGE_10_PLUS', label: '10+' },
  { value: 'AGE_13_PLUS', label: '13+' },
]

const REPORT_REASONS = [
  { value: 'INAPPROPRIATE', label: 'Contenu inapproprié' },
  { value: 'MISLEADING', label: 'Contenu trompeur' },
  { value: 'VIOLENCE', label: 'Violence' },
  { value: 'COPYRIGHT', label: 'Droits d\'auteur' },
  { value: 'OTHER', label: 'Autre' },
]

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${sec}s`
}

export default function VideosPage() {
  const locale = useLocale()
  const { token } = useAuth()

  const [q, setQ] = useState('')
  const [lang, setLang] = useState('')
  const [ageRating, setAgeRating] = useState('')
  const [results, setResults] = useState<VideoSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Add-to-playlist modal
  const [addTarget, setAddTarget] = useState<{ id: string; title: string } | null>(null)

  // Report modal
  const [reportTarget, setReportTarget] = useState<{ id: string; title: string } | null>(null)
  const [reportReason, setReportReason] = useState('INAPPROPRIATE')
  const [reportDescription, setReportDescription] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState('')

  const search = useCallback(async (p = 1) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.videos.search(token, { q: q || undefined, language: lang || undefined, ageRating: ageRating || undefined, page: p, limit: 24 })
      setResults(res.items)
      setTotal(res.total)
      setPages(res.pages)
      setPage(p)
      setSearched(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [token, q, lang, ageRating])

  useEffect(() => { search(1) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search(1)
  }

  const openReport = (v: VideoSearchResult) => {
    setReportTarget({ id: v.id, title: v.title })
    setReportReason('INAPPROPRIATE')
    setReportDescription('')
    setReportDone(false)
    setReportError('')
  }

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !reportTarget) return
    setReporting(true)
    setReportError('')
    try {
      await api.videos.report(token, reportTarget.id, { reason: reportReason, description: reportDescription || undefined })
      setReportDone(true)
      setTimeout(() => setReportTarget(null), 1500)
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : 'Erreur lors du signalement.')
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vidéothèque</h1>
          {searched && <p className="text-sm text-gray-400 mt-0.5">{total} vidéo{total !== 1 ? 's' : ''} approuvée{total !== 1 ? 's' : ''}</p>}
        </div>
        <Link
          href={`/${locale}/dashboard/videos/new`}
          className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Soumettre
        </Link>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher par titre…"
            className="flex-1 min-w-48 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="text"
            value={lang}
            onChange={e => setLang(e.target.value)}
            placeholder="Langue (fr, en…)"
            className="w-36 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <select
            value={ageRating}
            onChange={e => setAgeRating(e.target.value)}
            className="w-40 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {AGE_RATINGS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? '…' : 'Rechercher'}
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-gray-500 mb-2">{searched ? 'Aucun résultat pour cette recherche.' : 'Lancez une recherche.'}</p>
          <Link href={`/${locale}/dashboard/videos/new`} className="text-sm text-indigo-600 hover:underline">
            Soumettre une vidéo →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {results.map(v => (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 hover:shadow-sm transition-all group relative">
                {/* Thumbnail */}
                <div className="relative w-full bg-gray-100" style={{ paddingBottom: '56.25%' }}>
                  {v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  {v.durationSec && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(v.durationSec)}
                    </span>
                  )}
                  {/* Hover overlay — add to playlist */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-start p-2">
                    <button
                      onClick={() => setAddTarget({ id: v.id, title: v.title })}
                      className="h-7 px-3 bg-white text-gray-900 text-xs font-semibold rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      + Playlist
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug pr-5">{v.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {v.language && <span className="text-xs text-gray-400 uppercase">{v.language}</span>}
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 ml-auto">
                      {v.ageRating.replace('_', '+')}
                    </span>
                  </div>
                </div>

                {/* Report button — top-right corner */}
                <button
                  onClick={() => openReport(v)}
                  title="Signaler cette vidéo"
                  className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V5a2 2 0 012-2h14l-3 3H5v13" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 6l11-1 1 6-12 1V6z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => search(page - 1)}
                disabled={page <= 1 || loading}
                className="h-9 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Précédent
              </button>
              <span className="text-sm text-gray-500">Page {page} / {pages}</span>
              <button
                onClick={() => search(page + 1)}
                disabled={page >= pages || loading}
                className="h-9 px-4 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      {/* Add-to-playlist modal */}
      {addTarget && token && (
        <AddToPlaylistModal
          videoId={addTarget.id}
          videoTitle={addTarget.title}
          token={token}
          onClose={() => setAddTarget(null)}
        />
      )}

      {/* Report modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReportTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Signaler une vidéo</h2>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{reportTarget.title}</p>
              </div>
              <button onClick={() => setReportTarget(null)} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {reportDone ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-green-600 font-medium text-sm">Signalement envoyé</p>
                <p className="text-xs text-gray-400">Notre équipe examinera cette vidéo.</p>
              </div>
            ) : (
              <form onSubmit={handleReport} className="space-y-3">
                {reportError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{reportError}</div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Motif</label>
                  <div className="grid grid-cols-1 gap-1">
                    {REPORT_REASONS.map(r => (
                      <label key={r.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${reportReason === r.value ? 'bg-red-50 border-red-200' : 'border-transparent hover:bg-gray-50'}`}>
                        <input
                          type="radio" name="reason" value={r.value}
                          checked={reportReason === r.value}
                          onChange={() => setReportReason(r.value)}
                          className="accent-red-500"
                        />
                        <span className="text-sm text-gray-700">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Détails <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <textarea
                    value={reportDescription}
                    onChange={e => setReportDescription(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Précisez si nécessaire…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={reporting}
                  className="w-full h-9 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {reporting ? 'Envoi…' : 'Envoyer le signalement'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
