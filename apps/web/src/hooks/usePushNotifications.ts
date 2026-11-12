'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const arr = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr
}

export function usePushNotifications(token: string | null) {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)

    // Check if already subscribed
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  const subscribe = useCallback(async () => {
    if (!token || loading) return
    setLoading(true)
    try {
      const { publicKey } = await api.notifications.getVapidKey()
      if (!publicKey) throw new Error('VAPID key unavailable')

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = sub.toJSON()
      const keys = json.keys as { p256dh: string; auth: string }
      await api.notifications.subscribeWebPush(token, {
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })

      setPermission('granted')
      setSubscribed(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission('denied')
      }
    } finally {
      setLoading(false)
    }
  }, [token, loading])

  const unsubscribe = useCallback(async () => {
    if (!token || loading) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.notifications.unsubscribeWebPush(token, sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }, [token, loading])

  return { permission, subscribed, loading, subscribe, unsubscribe }
}
