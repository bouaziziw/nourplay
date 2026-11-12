/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

self.addEventListener('push', event => {
  if (!event.data) return

  let data: { title?: string; body?: string; type?: string; data?: Record<string, unknown> } = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'NourPlay', body: event.data.text() }
  }

  const title = data.title ?? 'NourPlay'
  const options: NotificationOptions = {
    body: data.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.type ?? 'nourplay',
    renotify: true,
    data: { type: data.type, ...data.data },
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const notifData = event.notification.data as { type?: string } | undefined
  const targetUrl = notifData?.type === 'APPROVAL_REQUESTED' ? '/dashboard/approvals' : '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
