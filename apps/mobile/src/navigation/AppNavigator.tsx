import React, { useContext } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Text, TouchableOpacity } from 'react-native'
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
  ProfileSelector: { unlockParent?: boolean } | undefined
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

  usePushNotifications(auth?.token ?? null)

  if (!auth || !childCtx) return null

  if (auth.loading || !childCtx.hydrated) return null

  const navigationKey = !auth.token
    ? 'auth'
    : auth.parentModeUnlocked
      ? 'parent'
      : childCtx.session
        ? 'child-active'
        : 'child-select'

  return (
    <Stack.Navigator
      key={navigationKey}
      initialRouteName={
        auth.parentModeUnlocked
          ? 'ParentTabs'
          : auth.token && childCtx.session
            ? 'ChildPlaylists'
            : undefined
      }
      screenOptions={{ headerShown: false }}
    >
      {!auth.token ? (
        // ── Auth stack ─────────────────────────────────────────────────────────
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
        </>
      ) : auth.parentModeUnlocked ? (
        // ── Parent stack (unlocked with account password) ───────────────────────
        <>
          <Stack.Screen name="ProfileSelector" component={ProfileSelectorScreen} />
          <Stack.Screen name="ParentTabs" component={ParentTabNavigator} />
          <Stack.Screen
            name="ParentPlaylistDetail"
            component={ParentPlaylistDetailScreen}
            options={{
              headerShown: true,
              headerTitle: 'Playlist',
              headerBackTitle: 'Retour',
              headerRight: () => <LockParentModeAction />,
            }}
          />
        </>
      ) : (
        // ── Child stack (active child session) ─────────────────────────────────
        <>
          <Stack.Screen name="ProfileSelector" component={ProfileSelectorScreen} />
          <Stack.Screen name="ChildPlaylists" component={ChildPlaylistsScreen} />
          <Stack.Screen
            name="ChildPlaylistDetail"
            component={ChildPlaylistDetailScreen}
            options={({ navigation }) => ({
              headerShown: true,
              headerTitle: '',
              headerBackTitle: 'Retour',
              headerRight: () => (
                <ParentModeAction onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })} />
              ),
            })}
          />
          <Stack.Screen
            name="Watch"
            component={WatchScreen}
            options={({ navigation }) => ({
              headerShown: true,
              headerTitle: '',
              headerBackTitle: 'Retour',
              headerTransparent: true,
              headerRight: () => (
                <ParentModeAction onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })} />
              ),
            })}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

function ParentModeAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: '#4f46e5', fontWeight: '700', fontSize: 13 }}>Parent</Text>
    </TouchableOpacity>
  )
}

function LockParentModeAction() {
  const auth = useContext(AuthContext)
  const childSession = useContext(ChildSessionContext)
  return (
    <TouchableOpacity
      onPress={() => {
        auth?.lockParentMode()
        void childSession?.clear()
      }}
      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <Text style={{ color: '#4f46e5', fontWeight: '700', fontSize: 13 }}>Enfant</Text>
    </TouchableOpacity>
  )
}
