'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../hooks/useAuth'
import { useChildSession } from '../../../hooks/useChildSession'
import { PinModal } from '../../../components/PinModal'
import { ProfileAvatar } from '../../../components/ProfileAvatar'
import { api, ProfileSummary } from '../../../lib/api'

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3', AGE_4_6: '4–6', AGE_7_9: '7–9',
  AGE_10_12: '10–12', AGE_13_15: '13–15',
}

export default function ChildProfileSelector() {
  const locale = useLocale()
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const { set: setSession } = useChildSession()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProfileSummary | null>(null)

  useEffect(() => {
    if (!token) return
    api.users.profiles(token)
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handlePinSuccess = (pin: string) => {
    if (!token || !selected) return Promise.reject()
    return api.users.verifyPin(token, selected.id, pin).then(() => {
      setSession({
        profileId: selected.id,
        displayName: selected.displayName,
        ageGroup: selected.ageGroup,
        dailyLimitMin: selected.dailyLimitMin,
        sessionLimitMin: selected.sessionLimitMin,
        viewingSchedule: selected.viewingSchedule,
      })
      router.push(`/${locale}/child/playlists`)
    })
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Qui regarde ?</h1>
        <p className="text-gray-500 mt-2 text-sm">Choisissez votre profil pour commencer</p>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center">
          <p className="text-gray-400 mb-4">Aucun profil enfant disponible.</p>
          <p className="text-sm text-gray-500">Le parent peut déverrouiller le Mode Parent pour créer un profil.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="group flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-white/80 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              <div className="transition-transform group-hover:scale-110">
                <ProfileAvatar avatarKey={p.avatarKey} displayName={p.displayName} size={80} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-sm">{p.displayName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{AGE_LABELS[p.ageGroup] ?? p.ageGroup} ans</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PinModal
          profileName={selected.displayName}
          onSubmit={handlePinSuccess}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
