'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, VideoSearchResult, VideoSubmission, Tag, ApiError } from '../../../../lib/api'
import { AddToPlaylistModal } from '../../../../components/AddToPlaylistModal'
import { AddToFavoritesModal } from '../../../../components/AddToFavoritesModal'
import { RemoteImage } from '../../../../components/RemoteImage'

const VIDEO_URL_RE = /https?:\/\/(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be|vimeo\.com)\//i
const SUBMISSIONS_PER_PAGE = 8

const AGE_RATINGS = [
  { value: '', label: 'Tous' },
  { value: 'ALL', label: 'Tous publics' },
  { value: 'AGE_4_PLUS', label: '4+' },
  { value: 'AGE_7_PLUS', label: '7+' },
  { value: 'AGE_10_PLUS', label: '10+' },
  { value: 'AGE_13_PLUS', label: '13+' },
]

const LANGUAGES = [
  { value: '', label: 'Toutes les langues' },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
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
  const { token, user } = useAuth()

  const [q, setQ] = useState('')
  const [lang, setLang] = useState('')
  const [ageRating, setAgeRating] = useState('')
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [results, setResults] = useState<VideoSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // Autocomplete
  type Suggestion = { id: string; title: string; thumbnailUrl?: string | null }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Add-to-playlist modal
  const [addTarget, setAddTarget] = useState<{ id: string; title: string } | null>(null)

  // Add-to-favorites modal
  const [favTarget, setFavTarget] = useState<{ id: string; title: string } | null>(null)

  // Quick-add modal
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickForm, setQuickForm] = useState({ url: '', ageRating: 'ALL', language: '' })
  const [quickError, setQuickError] = useState('')
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [quickSubmitted, setQuickSubmitted] = useState<{
    id: string
    title: string
    validationStatus: string
    submitterApprovedAt: string | null
  } | null>(null)
  const [quickValidationStarted, setQuickValidationStarted] = useState(false)
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState('')
  const [submissionsPage, setSubmissionsPage] = useState(1)
  const [approvingSubmission, setApprovingSubmission] = useState<string | null>(null)

  // Report modal
  const [reportTarget, setReportTarget] = useState<{ id: string; title: string } | null>(null)
  const [reportReason, setReportReason] = useState('INAPPROPRIATE')
  const [reportDescription, setReportDescription] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportDone, setReportDone] = useState(false)
  const [reportError, setReportError] = useState('')

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

  useEffect(() => {
    if (!token) return
    api.videos.listTags(token).then(setAvailableTags).catch(() => {})
  }, [token])

  // Debounced autocomplete
  useEffect(() => {
    if (!token || q.trim().length < 2) { setSuggestions([]); return }
    const timer = setTimeout(() => {
      api.videos.autocomplete(token, q)
        .then(items => { setSuggestions(items); setSuggestionIndex(-1) })
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [token, q])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const search = useCallback(async (p = 1) => {
    if (!token) return
    setLoading(true)
    try {
      const res = await api.videos.search(token, {
        q: q || undefined,
        language: lang || undefined,
        ageRating: ageRating || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
        page: p,
        limit: 24,
      })
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
  }, [token, q, lang, ageRating, selectedTags])

  useEffect(() => { search(1) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setShowSuggestions(false)
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

  const openQuickAdd = async () => {
    let prefill = ''
    try {
      const text = await navigator.clipboard.readText()
      if (VIDEO_URL_RE.test(text.trim())) prefill = text.trim()
    } catch { /* clipboard permission denied — silent */ }
    setQuickForm({ url: prefill, ageRating: 'ALL', language: '' })
    setQuickError('')
    setQuickSubmitted(null)
    setQuickValidationStarted(false)
    setQuickOpen(true)
  }

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setQuickError('')
    setQuickSubmitting(true)
    try {
      const video = await api.videos.submit(token, {
        url: quickForm.url.trim(),
        ageRating: quickForm.ageRating,
        language: quickForm.language.trim() || undefined,
      })
      const submitterApprovedAt = video.submitterApprovedAt ?? null
      setQuickSubmitted({
        id: video.id,
        title: video.title,
        validationStatus: video.validationStatus,
        submitterApprovedAt,
      })
      setQuickValidationStarted(true)
      void loadSubmissions()
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setQuickSubmitting(false)
    }
  }

  const approveSubmission = async (id: string) => {
    if (!token) return
    setApprovingSubmission(id)
    setSubmissionsError('')
    try {
      const updated = await api.videos.approveSubmission(token, id)
      setSubmissions(items => items.map(item =>
        item.id === id ? { ...item, ...updated, submitterApprovedAt: updated.submitterApprovedAt } : item,
      ))
      if (quickSubmitted?.id === id) setQuickValidationStarted(true)
    } catch (err) {
      setSubmissionsError(err instanceof Error ? err.message : 'Impossible de valider cette vidéo.')
    } finally {
      setApprovingSubmission(null)
    }
  }

  const submissionsPages = Math.ceil(submissions.length / SUBMISSIONS_PER_PAGE)
  const visibleSubmissions = submissions.slice(
    (submissionsPage - 1) * SUBMISSIONS_PER_PAGE,
    submissionsPage * SUBMISSIONS_PER_PAGE,
  )

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(submissions.length / SUBMISSIONS_PER_PAGE))
    if (submissionsPage > lastPage) setSubmissionsPage(lastPage)
  }, [submissions.length, submissionsPage])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vidéothèque</h1>
          {searched && <p className="text-sm text-gray-400 mt-0.5">{total} vidéo{total !== 1 ? 's' : ''} approuvée{total !== 1 ? 's' : ''}</p>}
        </div>
        <button
          onClick={openQuickAdd}
          className="h-9 px-4 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Soumettre
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Autocomplete combobox */}
          <div className="relative flex-1 min-w-48">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={e => { setQ(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
              onKeyDown={e => {
                if (!showSuggestions || suggestions.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSuggestionIndex(i => Math.max(i - 1, -1))
                } else if (e.key === 'Enter' && suggestionIndex >= 0) {
                  e.preventDefault()
                  const s = suggestions[suggestionIndex]
                  setQ(s.title)
                  setShowSuggestions(false)
                  search(1)
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false)
                }
              }}
              placeholder="Rechercher par titre…"
              autoComplete="off"
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      setQ(s.title)
                      setShowSuggestions(false)
                      setSuggestions([])
                      setTimeout(() => search(1), 0)
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                      i === suggestionIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {s.thumbnailUrl ? (
                      <RemoteImage src={s.thumbnailUrl} alt="" width={32} height={20} className="w-8 h-5 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-5 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                        <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-sm text-gray-800 truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="w-44 h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
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

        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {availableTags.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
                  selectedTags.includes(t.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
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
                    <RemoteImage
                      src={v.thumbnailUrl}
                      alt={v.title}
                      fill
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

                {/* Report button — top-left corner */}
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

                {/* Favorite button — top-right corner */}
                <button
                  onClick={() => setFavTarget({ id: v.id, title: v.title })}
                  title="Ajouter aux favoris d'un profil"
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/80 text-gray-400 hover:text-pink-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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


      {['PARENT', 'TEACHER'].includes(user?.role ?? '') && (
        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Mes vidéos ajoutées</h2>
              <p className="mt-0.5 text-xs text-gray-500">
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
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune vidéo soumise pour le moment.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleSubmissions.map(video => {
                  const statusLabel = video.validationStatus === 'PENDING'
                    ? 'Contrôle automatique en cours'
                    : video.validationStatus === 'NEEDS_REVIEW'
                      ? 'En attente d’un modérateur'
                      : video.validationStatus === 'APPROVED'
                        ? 'Approuvée par le système'
                        : 'Refusée par le système'
                  const statusColor = video.validationStatus === 'APPROVED'
                    ? 'bg-green-50 text-green-700'
                    : video.validationStatus === 'PENDING'
                      ? 'bg-amber-50 text-amber-700'
                      : video.validationStatus === 'NEEDS_REVIEW'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-red-50 text-red-700'

                  return (
                    <article
                      key={video.id}
                      className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                    >
                      <div className="relative aspect-video bg-gray-100">
                        {video.thumbnailUrl ? (
                          <RemoteImage
                            src={video.thumbnailUrl}
                            alt={video.title}
                            fill
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">🎥</div>
                        )}
                      </div>
                      <div className="space-y-3 p-3">
                        <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-gray-900">
                          {video.title}
                        </p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                        {video.validationStatus === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => approveSubmission(video.id)}
                            disabled={approvingSubmission === video.id}
                            className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-50"
                          >
                            {approvingSubmission === video.id ? 'Relance…' : 'Relancer le contrôle'}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
              {submissionsPages > 1 && (
                <nav aria-label="Pagination de mes vidéos ajoutées" className="flex items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setSubmissionsPage(current => Math.max(1, current - 1))}
                    disabled={submissionsPage === 1}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {submissionsPage} sur {submissionsPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubmissionsPage(current => Math.min(submissionsPages, current + 1))}
                    disabled={submissionsPage === submissionsPages}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      )}

      {/* Quick-add modal */}
      {quickOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQuickOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Soumettre une vidéo</h2>
                <p className="text-xs text-gray-400 mt-0.5">YouTube ou Vimeo uniquement</p>
              </div>
              <button onClick={() => setQuickOpen(false)} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {quickSubmitted ? (
              <div className="text-center py-4 space-y-1">
                <p className="text-green-600 font-medium text-sm">Vidéo soumise</p>
                <p className="text-xs text-gray-500 line-clamp-2">
                  <strong className="text-gray-700">{quickSubmitted.title}</strong>
                  {quickSubmitted.validationStatus === 'APPROVED'
                    ? ' — cette vidéo est déjà approuvée et disponible.'
                    : quickSubmitted.validationStatus === 'REJECTED'
                      ? ' — cette vidéo a été refusée par le système.'
                      : quickSubmitted.validationStatus === 'NEEDS_REVIEW'
                        ? ' — cette vidéo attend la vérification d’un modérateur.'
                        : quickValidationStarted
                          ? ' — la validation automatique prioritaire a démarré.'
                          : ' — la vidéo sera envoyée en validation automatique.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleQuickSubmit} className="space-y-3">
                {quickError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{quickError}</div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">URL de la vidéo</label>
                  <input
                    type="url"
                    value={quickForm.url}
                    onChange={e => setQuickForm(f => ({ ...f, url: e.target.value }))}
                    required
                    autoFocus
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Classification d&apos;âge</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {AGE_RATINGS.filter(r => r.value !== '').map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setQuickForm(f => ({ ...f, ageRating: r.value }))}
                        className={`py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          quickForm.ageRating === r.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Langue <span className="text-gray-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={quickForm.language}
                    onChange={e => setQuickForm(f => ({ ...f, language: e.target.value }))}
                    maxLength={10}
                    placeholder="fr, en, ar…"
                    className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={quickSubmitting}
                    className="flex-1 h-9 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {quickSubmitting ? 'Soumission…' : 'Soumettre'}
                  </button>
                  <Link
                    href={`/${locale}/dashboard/videos/new`}
                    className="h-9 px-3 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors flex items-center"
                  >
                    Formulaire complet
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
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

      {/* Add-to-favorites modal */}
      {favTarget && token && (
        <AddToFavoritesModal
          videoId={favTarget.id}
          videoTitle={favTarget.title}
          token={token}
          onClose={() => setFavTarget(null)}
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
