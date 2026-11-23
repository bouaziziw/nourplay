'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { isTvDevice } from '../hooks/useTvNavigation'

export function AuthenticatedHomeRedirect() {
  const { user, loading } = useAuth()
  const locale = useLocale()
  const router = useRouter()

  useEffect(() => {
    // Mode TV : basculer immédiatement en mode enfant par défaut
    if (isTvDevice()) {
      router.replace(`/${locale}/child/playlists`)
      return
    }
    if (!loading && user) router.replace(`/${locale}/child`)
  }, [loading, user, locale, router])

  return null
}
