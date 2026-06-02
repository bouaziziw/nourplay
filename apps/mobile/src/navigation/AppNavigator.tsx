import React, { useContext } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthContext } from '../hooks/useAuth'
import { ChildSessionContext } from '../hooks/useChildSession'
import { usePushNotifications } from '../hooks/usePushNotifications'

import LoginScreen from '../screens/LoginScreen'
import TwoFactorScreen from '../screens/TwoFactorScreen'
import ProfileSelectorScreen from '../screens/child/ProfileSelectorScreen'
import ChildPlaylistsScreen from '../screens/child/PlaylistsScreen'
import ChildPlaylistDetailScreen from '../screens/child/PlaylistDetailScreen'
import WatchScreen from '../screens/child/WatchScreen'
import ParentTabNavigator from './ParentTabNavigator'
import ParentPlaylistDetailScreen from '../screens/parent/ParentPlaylistDetailScreen'

export type RootStackParamList = {
  Login: undefined
  TwoFactor: { userId: string }
  ProfileSelector: undefined
  ParentTabs: undefined
  ParentPlaylistDetail: { playlistId: string; playlistName: string }
  ChildPlaylists: undefined
  ChildPlaylistDetail: { playlistId: string; playlistName: string }
  Watch: { videoId: string; playlistId: string }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function AppNavigator() {
  const auth = useContext(AuthContext)
  const childCtx = useContext(ChildSessionContext)

  if (!auth || !childCtx) return null

  const { session } = childCtx

  // Register Expo push token when the user is authenticated
  usePushNotifications(auth.token ?? null)

  if (auth.loading || !childCtx.hydrated) return null

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!auth.token ? (
        // ── Auth stack ─────────────────────────────────────────────────────────
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        </>
      ) : session ? (
        // ── Child stack (active child session) ─────────────────────────────────
        <>
          <Stack.Screen name="ChildPlaylists" component={ChildPlaylistsScreen} />
          <Stack.Screen name="ChildPlaylistDetail" component={ChildPlaylistDetailScreen} options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Retour' }} />
          <Stack.Screen name="Watch" component={WatchScreen} options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Retour', headerTransparent: true }} />
        </>
      ) : (
        // ── Parent stack ───────────────────────────────────────────────────────
        <>
          <Stack.Screen name="ProfileSelector" component={ProfileSelectorScreen} />
          <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
          <Stack.Screen
            name="ParentPlaylistDetail"
            component={ParentPlaylistDetailScreen}
            options={{ headerShown: true, headerTitle: 'Playlist', headerBackTitle: 'Retour' }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
