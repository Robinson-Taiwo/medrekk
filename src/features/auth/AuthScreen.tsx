import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Feather from '@expo/vector-icons/Feather'

import { Mark } from '@/components/design/Mark'
import { C } from '@/components/design/tokens'
import { useAuth } from './AuthProvider'
import type { Role } from './authApi'

/**
 * The first screen anybody sees, and until now the least considered one: it painted
 * gray-300 borders on bg-white, and carried `dark:` variants that followed the phone's own
 * theme — so on a dark-mode handset it turned black while every screen behind it stayed
 * light. That was the whole light/dark split.
 *
 * It is deliberately the one ink surface at the front of the app. The record itself is light
 * because it is read in daylight and under pressure; arriving is a brand moment, and the mark
 * on a dark field is what makes the app feel like the thing the website describes.
 */

const LABEL = 'text-[13px] font-medium text-mist'
const INPUT =
  'h-[52px] rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[15px] text-mist'

/** Two soft discs standing in for a radial glow, which React Native cannot blur natively. */
function Aura() {
  return (
    <View pointerEvents="none" className="absolute left-0 right-0 top-0 h-[360px] items-center justify-center">
      <View
        className="absolute rounded-full bg-glow"
        style={{ width: 460, height: 460, opacity: 0.06 }}
      />
      <View
        className="absolute rounded-full bg-glow"
        style={{ width: 260, height: 260, opacity: 0.09 }}
      />
    </View>
  )
}

function Field({
  label,
  hint,
  ...rest
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="gap-1.5">
      <Text className={LABEL}>{label}</Text>
      <TextInput className={INPUT} placeholderTextColor={C.mistFaint} {...rest} />
      {hint ? <Text className="text-xs leading-[17px] text-mist-faint">{hint}</Text> : null}
    </View>
  )
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [role, setRole] = useState<Role>('PATIENT')
  const [fullName, setFullName] = useState('')
  const [facility, setFacility] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === 'register'

  const submit = async () => {
    if (busy) return
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Your password needs at least 8 characters.')
    if (isRegister && fullName.trim().length < 2) return setError('Enter your full name.')
    setError(null)
    setBusy(true)
    try {
      if (isRegister) {
        await signUp({
          email,
          password,
          fullName: fullName.trim(),
          role,
          facility: role === 'HEALTH_WORKER' && facility.trim() ? facility.trim() : undefined,
          phone: phone.trim() ? phone.trim() : undefined,
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
    <SafeAreaView className="flex-1 bg-night" edges={['top', 'left', 'right']}>
      <Aura />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[440px] self-center">
            {/* ---- The mark ---- */}
            <View className="items-center gap-4">
              <View className="h-[62px] w-[62px] items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.06]">
                <Mark size={32} color={C.glow} />
              </View>
              <View className="items-center gap-2">
                <Text className="text-[30px] font-semibold tracking-tight text-mist">MedRekk</Text>
                <Text className="max-w-[30ch] text-center text-[14px] leading-[20px] text-mist-dim">
                  Your medical record, owned by you — and readable without a connection.
                </Text>
              </View>
            </View>

            {/* ---- Sign in or create ---- */}
            <View className="mt-9 flex-row rounded-xl border border-white/10 bg-white/[0.04] p-1">
              {(['login', 'register'] as const).map((value) => {
                const active = mode === value
                return (
                  <Pressable
                    key={value}
                    onPress={() => {
                      setMode(value)
                      setError(null)
                    }}
                    className={`h-10 flex-1 items-center justify-center rounded-[9px] ${
                      active ? 'bg-glow' : ''
                    }`}>
                    <Text
                      className={`text-[14px] font-medium ${active ? 'text-glow-ink' : 'text-mist-dim'}`}>
                      {value === 'login' ? 'Sign in' : 'Create account'}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View className="mt-6 gap-4">
              {isRegister ? (
                <View className="gap-2">
                  <Text className={LABEL}>I am a</Text>
                  <View className="flex-row gap-2.5">
                    {(
                      [
                        { key: 'PATIENT' as Role, label: 'Patient', icon: 'user' as const, note: 'I own a record' },
                        { key: 'HEALTH_WORKER' as Role, label: 'Health worker', icon: 'activity' as const, note: 'I record visits' },
                      ]
                    ).map((option) => {
                      const active = role === option.key
                      return (
                        <Pressable
                          key={option.key}
                          onPress={() => setRole(option.key)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: active }}
                          className={`flex-1 gap-2 rounded-xl border p-3.5 ${
                            active ? 'border-glow/60 bg-glow/10' : 'border-white/10 bg-white/[0.04]'
                          }`}>
                          <Feather
                            name={option.icon}
                            size={17}
                            color={active ? C.glow : C.mistFaint}
                          />
                          <Text
                            className={`text-[14px] font-medium ${active ? 'text-mist' : 'text-mist-dim'}`}>
                            {option.label}
                          </Text>
                          <Text className="text-[11px] leading-[15px] text-mist-faint">{option.note}</Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ) : null}

              {isRegister ? (
                <Field
                  label="Full name"
                  placeholder="Omoyeni Taiwo"
                  value={fullName}
                  onChangeText={setFullName}
                  autoComplete="name"
                />
              ) : null}

              {isRegister ? (
                <Field
                  label="Phone"
                  hint="Lets you read your record by dialling a short code, with no internet. You can add it later."
                  placeholder="08031234567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              ) : null}

              {isRegister && role === 'HEALTH_WORKER' ? (
                <Field
                  label="Facility"
                  hint="Shown to a patient when you ask for access, so they can see who is asking."
                  placeholder="Ilorin General Hospital"
                  value={facility}
                  onChangeText={setFacility}
                />
              ) : null}

              <Field
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
              />

              <Field
                label="Password"
                hint={isRegister ? 'At least 8 characters.' : undefined}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                onSubmitEditing={() => void submit()}
              />

              {error ? (
                <View className="flex-row items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3.5">
                  <Feather name="alert-circle" size={16} color="#FDA4AF" />
                  <Text accessibilityRole="alert" className="flex-1 text-[13px] leading-[19px] text-rose-200">
                    {error}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void submit()}
                disabled={busy}
                className={`mt-1 h-[54px] items-center justify-center rounded-xl bg-glow ${busy ? 'opacity-60' : ''}`}>
                {busy ? (
                  <ActivityIndicator color={C.glowInk} />
                ) : (
                  <Text className="text-[16px] font-semibold text-glow-ink">
                    {isRegister ? 'Create account' : 'Sign in'}
                  </Text>
                )}
              </Pressable>
            </View>

            <View className="mt-8 flex-row items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
              <Feather name="lock" size={15} color={C.glow} />
              <Text className="flex-1 text-[12px] leading-[17px] text-mist-faint">
                Your record stays on this phone. Nobody sees it until you approve a request, and
                every look is written down.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
