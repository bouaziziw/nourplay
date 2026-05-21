import React, { useContext } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthContext } from '../hooks/useAuth'
import { ChildSessionContext } from '../hooks/useChildSession'

import LoginScreen from '../screens/LoginScreen'
import TwoFactorScreen from '../screens/TwoFactorScreen'
import ProfileSelectorScreen from '../screens/child/ProfileSelectorScreen'
import ChildPlaylistsScreen from '../screens/child/PlaylistsScreen'
import ChildPlaylistDetailScreen from '../screens/child/PlaylistDetailScreen'
import WatchScreen from '../screens/child/WatchScreen'
import ParentDashboardScreen from '../screens/parent/DashboardScreen'

export type RootStackParamList = {
  Login: undefined
  TwoFactor: { userId: string }
  ProfileSelector: undefined
  ParentDashboard: undefined
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
        // ── Parent / profile selector stack ────────────────────────────────────
        <>
          <Stack.Screen name="ProfileSelector" component={ProfileSelectorScreen} />
          <Stack.Screen name="ParentDashboard" component={ParentDashboardScreen} options={{ headerShown: true, headerTitle: 'Tableau de bord', headerBackTitle: 'Profils' }} />
        </>
      )}
    </Stack.Navigator>
  )
}
