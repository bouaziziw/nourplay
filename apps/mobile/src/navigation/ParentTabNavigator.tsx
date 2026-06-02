import React from 'react'
import { Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
  )
}
