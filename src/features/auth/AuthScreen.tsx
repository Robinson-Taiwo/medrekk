import React, { useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from './AuthProvider'
import type { Role } from './authApi'


const inputClass =
  'rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:text-white'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<Role>('PATIENT')
  const [fullName, setFullName] = useState('')
  const [facility, setFacility] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'

  const submit = async () => {
    if (busy) return
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (isRegister && fullName.trim().length < 2) return setError('Enter your full name.')
    setError(null)
    setBusy(true)
    try {
      if (isRegister) {
        await signUp({
          email, password, fullName: fullName.trim(), role,
          facility: role === 'HEALTH_WORKER' && facility.trim() ? facility.trim() : undefined,
        })
      } else {
        await signIn(email, password)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-[440px] gap-3 self-center">
            <Text className="text-center text-4xl font-bold text-gray-900 dark:text-white">MedRekk</Text>
            <Text className="mb-2 text-center text-base text-gray-500 dark:text-gray-400">
              {isRegister ? 'Create your account' : 'Sign in to your medical record'}
            </Text>

            {isRegister && (
              <View className="flex-row gap-2">
                {(['PATIENT', 'HEALTH_WORKER'] as Role[]).map((r) => {
                  const active = role === r
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      className={`flex-1 items-center rounded-xl border py-3 ${
                        active ? 'border-[#0F6E56] bg-[#0F6E56]' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      <Text className={`font-semibold ${active ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {r === 'PATIENT' ? 'Patient' : 'Health worker'}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {isRegister && (
              <TextInput className={inputClass} placeholder="Full name" placeholderTextColor="#9ca3af"
                value={fullName} onChangeText={setFullName} autoComplete="name" />
            )}
            {isRegister && role === 'HEALTH_WORKER' && (
              <TextInput className={inputClass} placeholder="Facility (optional)" placeholderTextColor="#9ca3af"
                value={facility} onChangeText={setFacility} />
            )}
            <TextInput className={inputClass} placeholder="Email" placeholderTextColor="#9ca3af"
              value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
              keyboardType="email-address" autoComplete="email" />
            <TextInput className={inputClass} placeholder="Password (8+ characters)" placeholderTextColor="#9ca3af"
              value={password} onChangeText={setPassword} secureTextEntry
              autoComplete={isRegister ? 'new-password' : 'current-password'} onSubmitEditing={submit} />

            {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}

            <Pressable onPress={submit} disabled={busy}
              className={`mt-1 items-center rounded-xl bg-[#0F6E56] py-4 ${busy ? 'opacity-60' : ''}`}>
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text className="text-base font-semibold text-white">{isRegister ? 'Create account' : 'Sign in'}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => { setMode(isRegister ? 'login' : 'register'); setError(null) }}>
              <Text className="py-2 text-center text-sm text-[#0F6E56]">
                {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}