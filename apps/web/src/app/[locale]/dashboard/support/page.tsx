'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../../hooks/useAuth'
import { api, ProfileSummary, ApiError } from '../../../../lib/api'

const CATEGORIES = [
  { value: 'QUESTION_GENERAL', label: 'Question générale', icon: '❓', desc: 'Fonctionnement général de la plateforme' },
  { value: 'TECHNICAL_ISSUE', label: 'Problème technique / Bug', icon: '🛠️', desc: 'Difficulté d’affichage, son ou lecture' },
  { value: 'CONTENT_SUGGESTION', label: 'Suggestion de vidéo ou chaîne', icon: '🎬', desc: 'Proposer de nouveaux contenus éducatifs' },
  { value: 'PARENTAL_CONTROL', label: 'Contrôle parental & Minuteur', icon: '⏱️', desc: 'Code PIN, blocage ou limites de visionnage' },
  { value: 'BILLING_SUBSCRIPTION', label: 'Abonnement & Facturation', icon: '💳', desc: 'Offres, paiements ou gestion du plan' },
  { value: 'SAFETY_CONCERN', label: 'Signalement de sécurité / Contenu', icon: '🛡️', desc: 'Signaler un contenu inapproprié' },
  { value: 'OTHER', label: 'Autre demande', icon: '📝', desc: 'Tout autre sujet' },
]

export default function SupportPage() {
  const locale = useLocale()
  const router = useRouter()
  const { user, token, loading: authLoading } = useAuth()

  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const [category, setCategory] = useState('QUESTION_GENERAL')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [childProfileId, setChildProfileId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [lastSubmittedInfo, setLastSubmittedInfo] = useState<{
    subject: string
    category: string
    recipientsCount?: number
  } | null>(null)

  useEffect(() => {
    if (!token) return
    setLoadingProfiles(true)
    api.users.profiles(token)
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoadingProfiles(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    const trimmedSubject = subject.trim()
    const trimmedMessage = message.trim()

    if (trimmedSubject.length < 3) {
      setError('L’objet du message doit comporter au moins 3 caractères.')
      return
    }

    if (trimmedMessage.length < 10) {
      setError('Votre message doit comporter au moins 10 caractères pour nous permettre de vous répondre au mieux.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const res = await api.support.contact(token, {
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        childProfileId: childProfileId || undefined,
      })

      setLastSubmittedInfo({
        subject: trimmedSubject,
        category: CATEGORIES.find(c => c.value === category)?.label || category,
        recipientsCount: res.recipientsCount,
      })
      setSubmitted(true)
      setSubject('')
      setMessage('')
      setChildProfileId('')
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Impossible d’envoyer votre message pour le moment. Veuillez réessayer.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="w-8 h-8 border-4 border-[#1c90d8] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Vous devez être connecté pour contacter le support.</p>
        <Link href={`/${locale}/auth/login`} className="text-[#1c90d8] font-medium hover:underline">
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* ── Breadcrumb & Entête ── */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Link href={`/${locale}/dashboard`} className="hover:text-[#1c90d8] transition-colors">
            Espace Parent
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-semibold">Support & Service Client</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
              <span>💬</span> Support & Service Client
            </h1>
            <p className="text-sm text-gray-600 mt-1.5 max-w-2xl">
              Une question, une difficulté technique, une suggestion ou besoin d’aide pour le contrôle parental ?
              Envoyez un message direct à l’équipe d’administration de NourPlay.
            </p>
          </div>
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 shadow-xs transition-colors self-start sm:self-auto"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      </div>

      {/* ── Cartes d'information rapide ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-sky-50/80 border border-sky-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-[#1c90d8] flex items-center justify-center text-lg shrink-0">
            ⚡
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Réponse Rapide</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Traitement sous 24h à 48h ouvrées par nos administrateurs.
            </p>
          </div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0">
            ✉️
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Email Direct</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Réponse transmise directement à <strong>{user.email}</strong>.
            </p>
          </div>
        </div>

        <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
            🛡️
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Sécurité Enfant</h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Signalements et requêtes parentales prioritaires.
            </p>
          </div>
        </div>
      </div>

      {/* ── Formulaire de Contact ou Écran de Succès ── */}
      {submitted ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center shadow-xs space-y-6 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-xs">
            ✓
          </div>

          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">Message envoyé avec succès !</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Votre demande a bien été transmise aux administrateurs de la plateforme. Un email de confirmation a également été envoyé à <strong className="text-gray-800">{user.email}</strong>.
            </p>
          </div>

          {lastSubmittedInfo && (
            <div className="max-w-md mx-auto bg-gray-50 rounded-2xl p-4 border border-gray-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Catégorie :</span>
                <span className="font-bold text-gray-800">{lastSubmittedInfo.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Objet :</span>
                <span className="font-bold text-gray-800 truncate max-w-[240px]">{lastSubmittedInfo.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date d’envoi :</span>
                <span className="font-medium text-gray-700">{new Date().toLocaleString(locale)}</span>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSubmitted(false)
                setLastSubmittedInfo(null)
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
            >
              Envoyer un autre message
            </button>
            <Link
              href={`/${locale}/dashboard`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1c90d8] hover:bg-[#1572ab] text-white text-xs font-bold transition-colors shadow-sm"
            >
              Retour à l’accueil Parent
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs flex items-start gap-3">
              <span className="text-base shrink-0">⚠️</span>
              <div>
                <p className="font-bold">Une erreur est survenue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Expéditeur */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1c90d8] text-white flex items-center justify-center text-xs font-black">
                {(user.email || 'P')[0].toUpperCase()}
              </div>
              <div>
                <span className="text-[11px] text-gray-500 font-medium block">Expéditeur vérifié (Compte Parent)</span>
                <span className="text-xs font-bold text-gray-900">{user.email}</span>
              </div>
            </div>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
              Parent actif
            </span>
          </div>

          {/* Choix de la catégorie */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wide mb-2">
              1. Type de demande <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CATEGORIES.map(cat => {
                const isSelected = category === cat.value
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#1c90d8] bg-sky-50/70 shadow-xs ring-2 ring-[#1c90d8]/20'
                        : 'border-gray-200 hover:border-sky-300 hover:bg-gray-50/80'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{cat.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${isSelected ? 'text-[#1c90d8]' : 'text-gray-900'}`}>
                        {cat.label}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {cat.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Profil enfant concerné (optionnel) */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wide mb-1.5">
              2. Profil enfant concerné <span className="text-gray-400 font-normal lowercase">(optionnel)</span>
            </label>
            <select
              value={childProfileId}
              onChange={e => setChildProfileId(e.target.value)}
              disabled={loadingProfiles}
              className="w-full h-11 px-3.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent transition-all"
            >
              <option value="">Non spécifique / Concerne l’ensemble du compte</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  👦 {p.displayName} ({p.ageGroup.replace('AGE_', '').replace('_', '–')} ans)
                </option>
              ))}
            </select>
          </div>

          {/* Objet du message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wide">
                3. Objet du message <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">{subject.length}/200</span>
            </div>
            <input
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ex : Question concernant le renouvellement de l’abonnement annuel"
              className="w-full h-11 px-3.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent transition-all"
            />
          </div>

          {/* Corps du message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wide">
                4. Votre message détaillé <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-gray-400">{message.length}/5000</span>
            </div>
            <textarea
              required
              rows={6}
              maxLength={5000}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Expliquez en détail votre situation, suggestion ou le problème rencontré..."
              className="w-full p-3.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1c90d8] focus:border-transparent transition-all leading-relaxed"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Minimum 10 caractères. Veuillez ne pas partager de mot de passe ou d’informations bancaires confidentielles.
            </p>
          </div>

          {/* Bouton d'envoi */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Un email contenant votre demande sera directement adressé aux administrateurs NourPlay.
            </p>

            <button
              type="submit"
              disabled={submitting || subject.trim().length < 3 || message.trim().length < 10}
              className="w-full sm:w-auto min-w-[200px] h-11 px-6 bg-[#1c90d8] hover:bg-[#1572ab] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Envoi en cours…</span>
                </>
              ) : (
                <>
                  <span>✉️</span>
                  <span>Envoyer aux administrateurs</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
