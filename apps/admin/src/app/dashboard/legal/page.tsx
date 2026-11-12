'use client'

import { useEffect, useState } from 'react'
import { api, LegalDocument, ApiError } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

const TYPE_LABELS: Record<string, string> = {
  TERMS: 'CGU',
  PRIVACY: 'Politique de confidentialité',
  COOKIE_ANALYTICS: 'Cookies analytiques',
  COOKIE_FUNCTIONAL: 'Cookies fonctionnels',
  PARENTAL_CONSENT: 'Consentement parental',
}

const TYPES = ['TERMS', 'PRIVACY']

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type FormState = { type: string; version: string; content: string }

export default function LegalPage() {
  const { token } = useAuth()
  const [docs, setDocs] = useState<LegalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('TERMS')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>({ type: 'TERMS', version: '', content: '' })
  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState<string | null>(null)
  const [preview, setPreview] = useState<LegalDocument | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = () => {
    if (!token) return
    setLoading(true)
    api.admin.listLegalDocuments(token)
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [token])

  const byType = (type: string) =>
    docs.filter(d => d.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const currentPublished = (type: string) =>
    byType(type).find(d => d.publishedAt !== null) ?? null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      await api.admin.createLegalDocument(token, form)
      setSuccess('Document créé en brouillon.')
      setShowForm(false)
      setForm({ type: 'TERMS', version: '', content: '' })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (id: string) => {
    if (!token) return
    setPublishing(id)
    setError('')
    try {
      await api.admin.publishLegalDocument(token, id)
      setSuccess('Document publié.')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la publication.')
    } finally {
      setPublishing(null)
    }
  }

  const openPreview = async (id: string) => {
    if (!token) return
    try {
      const doc = await api.admin.getLegalDocument(token, id)
      setPreview(doc)
    } catch { /* ignore */ }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Textes légaux</h1>
          <p className="text-sm text-gray-400 mt-1">Gérez les versions de CGU et Politique de confidentialité</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(''); setSuccess('') }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Nouvelle version
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-sm text-green-400">{success}</div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-xl p-1 w-fit">
        {TYPES.map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              activeType === type ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {TYPE_LABELS[type] ?? type}
          </button>
        ))}
      </div>

      {/* Current published banner */}
      {(() => {
        const current = currentPublished(activeType)
        return (
          <div className={`mb-4 rounded-xl px-4 py-3 flex items-center justify-between ${current ? 'bg-green-500/10 border border-green-500/20' : 'bg-gray-800 border border-gray-700'}`}>
            <div>
              <span className={`text-xs font-bold uppercase tracking-wide ${current ? 'text-green-400' : 'text-gray-500'}`}>
                {current ? 'Version publiée active' : 'Aucune version publiée'}
              </span>
              {current && (
                <p className="text-sm text-white mt-0.5">
                  <span className="font-mono font-bold">{current.version}</span>
                  <span className="text-gray-400 ml-2">· publiée le {fmtDate(current.publishedAt)}</span>
                </p>
              )}
            </div>
            {current && (
              <button
                onClick={() => openPreview(current.id)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Voir le contenu
              </button>
            )}
          </div>
        )
      })()}

      {/* Versions table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Version</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Statut</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Créé le</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Publié le</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {byType(activeType).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 py-10">
                    Aucun document pour ce type. Créez une première version.
                  </td>
                </tr>
              ) : byType(activeType).map(doc => (
                <tr key={doc.id} className="border-b border-gray-700/50 hover:bg-gray-750 last:border-0">
                  <td className="px-4 py-3 font-mono text-white font-semibold">{doc.version}</td>
                  <td className="px-4 py-3">
                    {doc.publishedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-xs font-bold">
                        ● Publié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                        ○ Brouillon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(doc.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDate(doc.publishedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openPreview(doc.id)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        Voir
                      </button>
                      {!doc.publishedAt && (
                        <button
                          onClick={() => handlePublish(doc.id)}
                          disabled={publishing === doc.id}
                          className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {publishing === doc.id ? '…' : 'Publier'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-bold text-white">Nouvelle version de document légal</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {TYPES.map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Version (date ISO)</label>
                  <input
                    type="text"
                    placeholder="2026-01-01"
                    value={form.version}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    pattern="\d{4}-\d{2}-\d{2}"
                    required
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                  Contenu <span className="font-normal text-gray-500">(Markdown)</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  required
                  minLength={10}
                  rows={14}
                  placeholder="# CGU NourPlay&#10;&#10;## 1. Introduction&#10;&#10;..."
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {submitting ? 'Création…' : 'Créer (brouillon)'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[80vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
              <div>
                <h2 className="text-base font-bold text-white">
                  {TYPE_LABELS[preview.type] ?? preview.type} — v{preview.version}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {preview.publishedAt ? `Publié le ${fmtDate(preview.publishedAt)}` : 'Brouillon'}
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto p-6">
              <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {preview.content ?? '(contenu non disponible)'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
