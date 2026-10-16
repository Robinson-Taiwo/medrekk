import '../global.css'

import { useEffect } from 'react'
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, useColorScheme, View } from 'react-native'

import AppTabs from '@/components/app-tabs'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import AuthScreen from '@/features/auth/AuthScreen'

SplashScreen.preventAutoHideAsync()

function Gate() {
  const { status } = useAuth()

  // Nothing else hides the splash since the animated overlay was removed with the
  // Expo branding, so it has to go when there is real UI to show. The ceiling is
  // there so a slow sign-in check never leaves a frozen-looking splash on a demo.
  useEffect(() => {
    const hide = (): void => {
      void SplashScreen.hideAsync().catch(() => undefined)
    }
    if (status !== 'loading') {
      hide()
      return
    }
    const ceiling = setTimeout(hide, 2500)
    return () => clearTimeout(ceiling)
  }, [status])

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
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}