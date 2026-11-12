import React, { useContext } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AuthContext } from '../hooks/useAuth'
import { ChildSessionContext } from '../hooks/useChildSession'

import DashboardScreen from '../screens/parent/DashboardScreen'
import ParentPlaylistsScreen from '../screens/parent/ParentPlaylistsScreen'
import VideoLibraryScreen from '../screens/parent/VideoLibraryScreen'
import AccountScreen from '../screens/parent/AccountScreen'

type ParentTabParamList = {
  Home: undefined
  Playlists: undefined
  Videos: undefined
  Account: undefined
}

const Tab = createBottomTabNavigator<ParentTabParamList>()

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
}

export default function ParentTabNavigator() {
  const auth = useContext(AuthContext)
  const childSession = useContext(ChildSessionContext)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      <View style={{ height: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eef0f5' }}>
        <Text style={{ color: '#5145cd', fontWeight: '800', fontSize: 15 }}>Mode Parent</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            auth?.lockParentMode()
            void childSession?.clear()
          }}
          style={{ borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text style={{ color: '#4f46e5', fontWeight: '700', fontSize: 12 }}>Mode enfant</Text>
        </TouchableOpacity>
      </View>
      <Tab.Navigator
        screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5145cd',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          borderTopColor: '#e8eaf2',
          backgroundColor: '#ffffff',
          elevation: 12,
          shadowColor: '#172554',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        }}
      >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Playlists"
        component={ParentPlaylistsScreen}
        options={{
          title: 'Playlists',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideoLibraryScreen}
        options={{
          title: 'Vidéos',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎬" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: 'Compte',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
      </Tab.Navigator>
    </SafeAreaView>
  )
}
