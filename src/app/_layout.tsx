import '../global.css'

import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, useColorScheme, View } from 'react-native'

import { AnimatedSplashOverlay } from '@/components/animated-icon'
import AppTabs from '@/components/app-tabs'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import AuthScreen from '@/features/auth/AuthScreen'

SplashScreen.preventAutoHideAsync()

function Gate() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    )
  }
  return status === 'signedIn' ? <AppTabs /> : <AuthScreen />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}