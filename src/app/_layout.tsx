import '../global.css'

import { useEffect } from 'react'
import { DefaultTheme, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, View } from 'react-native'

import AppTabs from '@/components/app-tabs'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import AuthScreen from '@/features/auth/AuthScreen'
import { useSyncOnReconnect } from '@/sync/useSyncOnReconnect'

SplashScreen.preventAutoHideAsync()

function Gate() {
  const { status, user } = useAuth()

  // Empties the queue of anything captured while this handset had no connection. Mounted
  // here rather than on the capture screen so a worker who saves a visit and closes the app
  // still has it sent the next time the phone is online.
  useSyncOnReconnect(user?.role === 'HEALTH_WORKER' ? user.id : undefined)

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
  // One palette, pinned. Every screen paints the light MedRekk tokens, so letting the
  // navigator switch to DarkTheme on a dark-mode phone only gave the chrome a dark
  // background behind light screens — the same split that was fixed on the website.
  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}