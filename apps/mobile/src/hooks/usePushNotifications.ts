import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { api } from '../api'

// Couleur d'accentuation NourPlay
const BRAND_COLOR = '#1c90d8'

// Configure comment les notifications sont affichées lorsque l'application est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Envoie une notification locale immédiate sur l'appareil pour alerter
 * le parent ou l'enfant lorsque le temps d'écran autorisé est écoulé.
 */
export async function sendLocalScreenTimeNotification(profileName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Temps d’écran écoulé ⏰',
        body: `La session de visionnage de ${profileName} est terminée pour aujourd'hui.`,
        sound: 'default',
        color: BRAND_COLOR,
        data: { type: 'SCREEN_TIME_ALERT', profileName },
      },
      trigger: null, // Déclenchement instantané
    })
  } catch (err) {
    console.warn('Impossible d’émettre la notification locale de temps d’écran :', err)
  }
}

export function usePushNotifications(accessToken: string | null) {
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!accessToken || registeredRef.current) return

    registerForPushNotificationsAsync(accessToken)
      .then(() => { registeredRef.current = true })
      .catch(err => console.warn('Échec enregistrement push token :', err))
  }, [accessToken])

  // Écoute de la réception de notifications
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data
      if (data?.type === 'SCREEN_TIME_ALERT') {
        console.log('[Notification Reçue] Alerte temps d’écran :', notification.request.content.body)
      }
    })

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      console.log('[Notification Cliquée] Interaction utilisateur :', data)
    })

    return () => {
      receivedSubscription.remove()
      responseSubscription.remove()
    }
  }, [])
}

async function registerForPushNotificationsAsync(accessToken: string) {
  // Les notifications push Expo nécessitent un appareil physique
  if (!Device.isDevice) return

  type PermResponse = { granted: boolean; canAskAgain: boolean }
  const existingPerms = (await Notifications.getPermissionsAsync()) as unknown as PermResponse

  let finalGranted = existingPerms.granted

  if (!existingPerms.granted && existingPerms.canAskAgain) {
    const { granted } = (await Notifications.requestPermissionsAsync()) as unknown as PermResponse
    finalGranted = granted
  }

  if (!finalGranted) return

  // Configuration des canaux de notification sur Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'NourPlay',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: BRAND_COLOR,
    })

    await Notifications.setNotificationChannelAsync('screen-time', {
      name: 'Contrôle parental et temps d’écran',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 350, 200, 350],
      lightColor: '#ef4444',
    })
  }

  // Récupération de l'identifiant de projet Expo (EAS ou Config locale)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined

  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
  const token = tokenData.data
  const platform = Platform.OS === 'ios' ? 'ios' : 'android'

  await api.deviceTokens.register(accessToken, { token, platform })
}
