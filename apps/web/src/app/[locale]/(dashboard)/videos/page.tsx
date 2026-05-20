'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, VideoSearchResult } from '../../../../lib/api'

const AGE_RATINGS = [
  { value: '', label: 'Tous' },
  { value: 'ALL', label: 'Tous publics' },
  { value: 'AGE_4_PLUS', label: '4+' },
  { value: 'AGE_7_PLUS', label: '7+' },
  { value: 'AGE_10_PLUS', label: '10+' },
  { value: 'AGE_13_PLUS', label: '13+' },
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
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-indigo-300 hover:shadow-sm transition-all group">
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
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{v.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {v.language && <span className="text-xs text-gray-400 uppercase">{v.language}</span>}
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 ml-auto">
                      {v.ageRating.replace('_', '+')}
                    </span>
                  </div>
                </div>
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
    </div>
  )
}
