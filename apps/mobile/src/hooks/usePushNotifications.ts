import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { api } from '../api'

// Configure how notifications are presented when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushNotifications(accessToken: string | null) {
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!accessToken || registeredRef.current) return

    registerForPushNotificationsAsync(accessToken)
      .then(() => { registeredRef.current = true })
      .catch(() => {})
  }, [accessToken])
}

async function registerForPushNotificationsAsync(accessToken: string) {
  // Push notifications only work on physical devices
  if (!Device.isDevice) return

  // PermissionResponse.granted comes from expo-modules-core and is sometimes
  // not resolved by TypeScript depending on the project configuration.
  type PermResponse = { granted: boolean; canAskAgain: boolean }
  const existingPerms = await Notifications.getPermissionsAsync() as unknown as PermResponse

  let finalGranted = existingPerms.granted

  if (!existingPerms.granted && existingPerms.canAskAgain) {
    const { granted } = await Notifications.requestPermissionsAsync() as unknown as PermResponse
    finalGranted = granted
  }

  if (!finalGranted) return

  // On Android, set up a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'NourPlay',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    })
  }

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'

  await api.deviceTokens.register(accessToken, { token, platform })
}
