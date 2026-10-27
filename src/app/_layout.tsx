import '../global.css'

import { useEffect } from 'react'
import { colorScheme } from 'nativewind'
import { DefaultTheme, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { ActivityIndicator, View } from 'react-native'

import { useRouter } from 'expo-router'

import AppTabs from '@/components/app-tabs'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { FeedbackProvider } from '@/components/design/feedback'
import { TourProvider } from '@/features/tour/TourProvider'
import AuthScreen from '@/features/auth/AuthScreen'
import { useSyncOnReconnect } from '@/sync/useSyncOnReconnect'
import { attachNotificationTaps } from '@/features/notifications/push'

SplashScreen.preventAutoHideAsync()

/**
 * One palette, decided here rather than by the handset.
 *
 * app.json asks for "automatic", so on a phone set to dark mode NativeWind turned on every
 * `dark:` variant still scattered through the referral, emergency and offline-banner screens
 * — while the screens around them went on painting the light MedRekk tokens, because those
 * were migrated and these were not. The result was half a screen dark and half light, which
 * looks like a rendering fault rather than a theme.
 *
 * Pinning it here fixes all of them at once and cannot drift: a `dark:` variant someone adds
 * later simply never fires. The navigator is pinned to DefaultTheme for the same reason.
 */
colorScheme.set('light')

function Gate() {
  const { status, user } = useAuth()
  const router = useRouter()

  // A tapped notification lands on the thing it was about. The whole of expo-notifications
  // is loaded lazily inside this helper, so a build without the native module is quiet here
  // rather than fatal at import time.
  useEffect(() => attachNotificationTaps((to) => router.push(to)), [router])

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
      <FeedbackProvider>
        <AuthProvider>
          {/* Inside AuthProvider: the tour is keyed to who is signed in. */}
          <TourProvider>
            <Gate />
          </TourProvider>
        </AuthProvider>
      </FeedbackProvider>
    </ThemeProvider>
  )
}