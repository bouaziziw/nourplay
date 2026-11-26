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
            isViewingBlocked: autoProfile.isViewingBlocked,
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
        isViewingBlocked: selected.isViewingBlocked,
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
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-black bg-white">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-5xl font-black text-black">Qui regarde ? 🌈</h1>
        <p className="text-[#1c90d8] font-bold mt-3 text-sm sm:text-base">Choisis ton profil pour commencer tes vidéos</p>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center bg-white/80 p-8 rounded-3xl border border-black/10 max-w-md shadow-xl backdrop-blur-md">
          <p className="text-4xl mb-3">👶</p>
          <p className="text-black font-bold mb-2">Aucun profil enfant disponible.</p>
          <p className="text-sm text-black">Demande à ton parent de créer un profil enfant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 w-full max-w-2xl px-4">
          {profiles.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              data-tv-focus={idx === 0 ? "primary" : undefined}
              tabIndex={0}
              className="group flex flex-col items-center gap-3 p-5 rounded-3xl bg-white/70 border border-black/10 hover:border-[#1c90d8] hover:shadow-xl transition-all duration-200 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#1c90d8] focus:scale-105 shadow-sm"
            >
              <div className="transition-transform group-hover:scale-110 group-focus:scale-110">
                <ProfileAvatar avatarKey={p.avatarKey} displayName={p.displayName} size={84} />
              </div>
              <div className="text-center">
                <p className="font-black text-black text-base group-hover:text-[#1c90d8] transition-colors">{p.displayName}</p>
                <p className="text-xs text-[#1c90d8] font-extrabold mt-1 bg-[#1c90d8]/10 px-2.5 py-0.5 rounded-full border border-[#1c90d8]/30 inline-block shadow-xs">
                  {AGE_LABELS[p.ageGroup] ?? p.ageGroup} ans
                </p>
                {p.isViewingBlocked && (
                  <p className="text-[11px] text-rose-600 font-extrabold mt-1 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    ⏸️ En pause
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('nourplay:open-parent-unlock'))
          }}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-extrabold transition-all shadow-xs active:scale-95"
        >
          <span>🔒</span>
          <span>Accéder au Mode Parent</span>
        </button>
      </div>

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
