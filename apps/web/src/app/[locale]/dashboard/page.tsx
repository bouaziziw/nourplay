'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../hooks/useAuth'
import { useChildSession } from '../../../hooks/useChildSession'
import { PinModal } from '../../../components/PinModal'
import { ProfileAvatar } from '../../../components/ProfileAvatar'
import { api, ProfileSummary } from '../../../lib/api'

interface Playlist { id: string; name: string; _count: { playlistVideos: number } }

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const router = useRouter()
  const { user, token, loading } = useAuth()
  const { set: setChildSession } = useChildSession()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedProfile, setSelectedProfile] = useState<ProfileSummary | null>(null)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [dupToast, setDupToast] = useState('')

  const loadPlaylists = useCallback(() => {
    if (!token) return
    api.playlists.list(token).then(setPlaylists).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.users.profiles(token).then(setProfiles).catch(() => {}),
      api.playlists.list(token).then(setPlaylists).catch(() => {}),
    ])
  }, [token])

  const handleDuplicate = async (playlistId: string) => {
    if (!token) return
    setDuplicating(playlistId)
    try {
      const copy = await api.playlists.duplicate(token, playlistId)
      loadPlaylists()
      router.push(`/${locale}/dashboard/playlists/${copy.id}/edit`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la duplication.'
      setDupToast(msg)
      setTimeout(() => setDupToast(''), 3000)
    } finally {
      setDuplicating(null)
    }
  }

  const handlePinSuccess = (pin: string) => {
    if (!token || !selectedProfile) return Promise.reject()
    return api.users.verifyPin(token, selectedProfile.id, pin).then(() => {
      setChildSession({
        profileId: selectedProfile.id,
        displayName: selectedProfile.displayName,
        ageGroup: selectedProfile.ageGroup,
        dailyLimitMin: selectedProfile.dailyLimitMin,
        sessionLimitMin: selectedProfile.sessionLimitMin,
        viewingSchedule: selectedProfile.viewingSchedule,
      })
      router.push(`/${locale}/child/playlists`)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Vous devez être connecté.</p>
        <Link href={`/${locale}/auth/login`} className="text-indigo-600 font-medium hover:underline">Se connecter</Link>
      </div>
    )
  }

  const ageLabels: Record<string, string> = {
    AGE_0_3: '0–3 ans', AGE_4_6: '4–6 ans', AGE_7_9: '7–9 ans',
    AGE_10_12: '10–12 ans', AGE_13_15: '13–15 ans',
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('welcome')}</h1>
        <p className="text-gray-500 mt-1 text-sm">{user.email}</p>
      </div>

      {/* Profils enfants */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('profiles')}</h2>
          <Link href={`/${locale}/dashboard/profiles/new`}
            className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1">
            + {t('createProfile')}
          </Link>
        </div>

        {profiles.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">{t('noProfiles')}</p>
            <Link href={`/${locale}/dashboard/profiles/new`}
              className="inline-flex items-center justify-center h-9 px-4 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              {t('createProfile')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {profiles.map(p => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => setSelectedProfile(p)}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="mx-auto mb-3">
                    <ProfileAvatar avatarKey={p.avatarKey} displayName={p.displayName} size={56} />
                  </div>
                  <p className="font-medium text-gray-900 text-sm truncate">{p.displayName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ageLabels[p.ageGroup] ?? p.ageGroup}</p>
                  <span className="text-xs text-indigo-500 mt-1 block">▶ Mode enfant</span>
                </button>
                <Link
                  href={`/${locale}/dashboard/profiles/${p.id}`}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                  title="Modifier"
                  onClick={e => e.stopPropagation()}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Co-visionnage */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Co-visionnage</h2>
          <Link href={`/${locale}/dashboard/watch-party/new`}
            className="text-sm text-indigo-600 font-medium hover:underline">
            + Nouvelle salle
          </Link>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">Regarder ensemble</p>
            <p className="text-xs text-gray-500 mt-0.5">Créez une salle et partagez un code à 6 caractères.</p>
          </div>
          <Link
            href={`/${locale}/dashboard/watch-party/new`}
            className="shrink-0 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-4 py-2 rounded-lg"
          >
            Démarrer
          </Link>
        </div>
      </section>

      {/* Playlists */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('playlists')}</h2>
          <Link href={`/${locale}/dashboard/playlists/new`}
            className="text-sm text-indigo-600 font-medium hover:underline">
            + {t('createPlaylist')}
          </Link>
        </div>

        {playlists.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm mb-3">{t('noPlaylists')}</p>
            <Link href={`/${locale}/dashboard/playlists/new`}
              className="inline-flex items-center justify-center h-9 px-4 bg-indigo-600 text-white text-sm rounded-lg font-medium hover:bg-indigo-700 transition-colors">
              {t('createPlaylist')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map(pl => (
              <div key={pl.id} className="relative group bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <Link href={`/${locale}/dashboard/playlists/${pl.id}`} className="block p-5">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{pl.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">{pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}</p>
                </Link>
                <button
                  onClick={() => handleDuplicate(pl.id)}
                  disabled={duplicating === pl.id}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Dupliquer la playlist"
                >
                  {duplicating === pl.id ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {selectedProfile && (
        <PinModal
          profileName={selectedProfile.displayName}
          onSubmit={handlePinSuccess}
          onClose={() => setSelectedProfile(null)}
        />
      )}
      {dupToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 pointer-events-none">
          {dupToast}
        </div>
      )}
    </div>
  )
}
