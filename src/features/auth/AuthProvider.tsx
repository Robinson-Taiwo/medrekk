import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearToken, loadToken, saveToken, setUnauthorizedHandler } from '@/services/session'
import { ApiError, fetchMe, login, register, type PublicUser, type Role } from './authApi'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  user: PublicUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { email: string; password: string; fullName: string; role: Role; facility?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [user, setUser] = useState<PublicUser | null>(null)

  const signOut = useCallback(async () => {
    await clearToken()
    setUser(null)
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let token: string | null = null
      try {
        token = await loadToken()
      } catch {
        token = null
      }
      if (!token) {
        if (!cancelled) setStatus('signedOut')
        return
      }
      try {
        const me = await fetchMe(token)
        if (cancelled) return
        setUser(me)
        setStatus('signedIn')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await clearToken()
        if (!cancelled) setStatus('signedOut')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut()
    })
    return () => setUnauthorizedHandler(null)
  }, [signOut])

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await login(email.trim().toLowerCase(), password)
    await saveToken(res.token)
    setUser(res.user)
    setStatus('signedIn')
  }, [])

  const signUp = useCallback<AuthValue['signUp']>(async (input) => {
    const res = await register({ ...input, email: input.email.trim().toLowerCase() })
    await saveToken(res.token)
    setUser(res.user)
    setStatus('signedIn')
  }, [])

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}