'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '../../../hooks/useAuth'
import { api } from '../../../lib/api'

interface Profile { id: string; displayName: string; ageGroup: string }
interface Playlist { id: string; name: string; _count: { playlistVideos: number } }

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const { user, token, loading } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])

  useEffect(() => {
    if (!token) return
    Promise.all([
      api.users.profiles(token).then(setProfiles).catch(() => {}),
      api.playlists.list(token).then(setPlaylists).catch(() => {}),
    ])
  }, [token])

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
              <Link key={p.id} href={`/${locale}/dashboard/profiles/${p.id}`}
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group">
                <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <p className="font-medium text-gray-900 text-sm truncate">{p.displayName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ageLabels[p.ageGroup] ?? p.ageGroup}</p>
              </Link>
            ))}
          </div>
        )}
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
              <Link key={pl.id} href={`/${locale}/dashboard/playlists/${pl.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm truncate">{pl.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{pl._count.playlistVideos} vidéo{pl._count.playlistVideos !== 1 ? 's' : ''}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
