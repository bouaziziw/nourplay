'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'

export function AuthenticatedHomeRedirect() {
  const { user, loading } = useAuth()
  const locale = useLocale()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace(`/${locale}/child`)
  }, [loading, user, locale, router])

  return null
}
