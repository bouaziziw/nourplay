'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export function useWebPush(token: string | null) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window)
  }, [])

  useEffect(() => {
    if (!isSupported) return

    // next-pwa registers the SW automatically; just check subscription state
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setIsSubscribed(sub !== null))
      .catch(() => {})
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported || !token) return
    setIsLoading(true)
    try {
      const { publicKey } = await api.notifications.getVapidKey()
      const reg = await navigator.serviceWorker.ready  // next-pwa already registered
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      const json = sub.toJSON()
      await api.notifications.subscribeWebPush(token, {
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      })
      setIsSubscribed(true)
    } catch {
      // Permission denied or VAPID not configured
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, token])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !token) return
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await api.notifications.unsubscribeWebPush(token, sub.endpoint)
      }
      setIsSubscribed(false)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, token])

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe }
}
