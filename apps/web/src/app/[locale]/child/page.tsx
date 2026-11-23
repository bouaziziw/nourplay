'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '../../../hooks/useAuth'
import { useChildSession } from '../../../hooks/useChildSession'
import { PinModal } from '../../../components/PinModal'
import { ProfileAvatar } from '../../../components/ProfileAvatar'
import { api, ProfileSummary } from '../../../lib/api'
import { isTvDevice } from '../../../hooks/useTvNavigation'

const AGE_LABELS: Record<string, string> = {
  AGE_0_3: '0–3', AGE_4_6: '4–6', AGE_7_9: '7–9',
  AGE_10_12: '10–12', AGE_13_15: '13–15',
}

export default function ChildProfileSelector() {
  const locale = useLocale()
  const router = useRouter()
  const { token, loading: authLoading } = useAuth()
  const { session, set: setSession } = useChildSession()
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ProfileSummary | null>(null)

  useEffect(() => {
    if (!token) return
    api.users.profiles(token)
      .then(profs => {
        setProfiles(profs)

        // Only auto-select on cold start in TV mode when NO child session is set yet
        if (isTvDevice() && profs.length > 0 && !session) {
          const autoProfile = profs[0]
          setSession({
            profileId: autoProfile.id,
            displayName: autoProfile.displayName,
            ageGroup: autoProfile.ageGroup,
            dailyLimitMin: autoProfile.dailyLimitMin,
            sessionLimitMin: autoProfile.sessionLimitMin,
            viewingSchedule: autoProfile.viewingSchedule,
          })
          router.replace(`/${locale}/child/playlists`)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, locale, router, session, setSession])

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
        <div className="animate-spin h-10 w-10 border-4 border-[#1c90d8] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-black text-white">Qui regarde ? 🌈</h1>
        <p className="text-gray-400 mt-2 text-sm">Choisis ton profil pour commencer tes vidéos</p>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center bg-slate-900/60 p-8 rounded-3xl border border-white/10 max-w-md">
          <p className="text-4xl mb-3">👶</p>
          <p className="text-gray-300 font-bold mb-2">Aucun profil enfant disponible.</p>
          <p className="text-sm text-gray-400">Demande à ton parent de créer un profil enfant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl px-4">
          {profiles.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              data-tv-focus={idx === 0 ? "primary" : undefined}
              tabIndex={0}
              className="group flex flex-col items-center gap-3 p-5 rounded-3xl bg-slate-900/80 border border-white/10 hover:bg-slate-800/90 hover:border-sky-400 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-sky-400 focus:scale-105"
            >
              <div className="transition-transform group-hover:scale-110 group-focus:scale-110">
                <ProfileAvatar avatarKey={p.avatarKey} displayName={p.displayName} size={84} />
              </div>
              <div className="text-center">
                <p className="font-black text-white text-base group-hover:text-sky-300 transition-colors">{p.displayName}</p>
                <p className="text-xs text-sky-400 font-bold mt-1 bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-800/50 inline-block">
                  {AGE_LABELS[p.ageGroup] ?? p.ageGroup} ans
                </p>
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
