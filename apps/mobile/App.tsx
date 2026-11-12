import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthContext, useAuthState } from './src/hooks/useAuth'
import { ChildSessionContext, useChildSessionState } from './src/hooks/useChildSession'
import AppNavigator from './src/navigation/AppNavigator'

function Providers({ children }: { children: React.ReactNode }) {
  const { state, login, loginWith2fa, logout, unlockParentMode, lockParentMode } = useAuthState()
  const childSession = useChildSessionState()
  const handleLogout = async () => {
    await logout()
    await childSession.clear()
  }

  return (
    <AuthContext.Provider value={{ ...state, login, loginWith2fa, logout: handleLogout, unlockParentMode, lockParentMode }}>
      <ChildSessionContext.Provider value={childSession}>
        {children}
      </ChildSessionContext.Provider>
    </AuthContext.Provider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Providers>
          <AppNavigator />
        </Providers>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
