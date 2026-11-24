import React, { useContext, useState } from 'react'
import { TouchableOpacity, Text, View, Platform, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AuthContext } from '../hooks/useAuth'
import { ChildSessionContext } from '../hooks/useChildSession'
import { ChildCountdownTimer } from '../components/ChildCountdownTimer'

// Auth screens
import LoginScreen from '../screens/LoginScreen'
import TwoFactorScreen from '../screens/TwoFactorScreen'

// Child screens
import ProfileSelectorScreen from '../screens/child/ProfileSelectorScreen'
import ChildPlaylistsScreen from '../screens/child/PlaylistsScreen'
import ChildPlaylistDetailScreen from '../screens/child/PlaylistDetailScreen'
import WatchScreen from '../screens/child/WatchScreen'

// Parent navigator & screens
import ParentTabNavigator from './ParentTabNavigator'
import ParentPlaylistDetailScreen from '../screens/parent/ParentPlaylistDetailScreen'

export type RootStackParamList = {
  Login: undefined
  TwoFactor: { userId: string }
  ProfileSelector: { unlockParent?: boolean } | undefined
  ChildPlaylists: undefined
  ChildPlaylistDetail: { playlistId: string; playlistName: string }
  Watch: { videoId: string; playlistId: string }
  ParentTabs: undefined
  ParentPlaylistDetail: { playlistId: string; playlistName: string }
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function AppNavigator() {
  const auth = useContext(AuthContext)

  if (!auth) return null

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#000000',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#ffffff' },
      }}
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
              headerTransparent: true,
              headerRight: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ChildTimerAction />
                  <ParentModeAction onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })} />
                </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ChildTimerAction />
                  <ParentModeAction onPress={() => navigation.navigate('ProfileSelector', { unlockParent: true })} />
                </View>
              ),
            })}
          />
        </>
      )}
    </Stack.Navigator>
  )
}

function ChildTimerAction() {
  const childCtx = useContext(ChildSessionContext)
  const session = childCtx?.session
  if (!session) return null
  return (
    <ChildCountdownTimer
      sessionLimitMin={session.sessionLimitMin}
      dailyLimitMin={session.dailyLimitMin}
      activatedAt={session.activatedAt}
    />
  )
}

function ParentModeAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: '#1c90d8',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>🔒 Mode Parent</Text>
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
      <Text style={{ color: '#1c90d8', fontWeight: '700', fontSize: 13 }}>Verrouiller</Text>
    </TouchableOpacity>
  )
}
