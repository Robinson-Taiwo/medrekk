import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearToken,
  loadCachedUser,
  loadToken,
  saveCachedUser,
  saveToken,
  setUnauthorizedHandler,
} from '@/services/session'
import { ApiError, fetchMe, login, register, type PublicUser, type Role } from './authApi'
import { forgetUnlock, rememberUnlock, verifyUnlock } from './offlineUnlock'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthValue {
  status: Status
  user: PublicUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: {
    email: string
    password: string
    fullName: string
    role: Role
    facility?: string
    phone?: string
  }) => Promise<void>
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
    // Signing out is deliberate, so everything this phone remembered goes: the token, the
    // cached record and the stored verifier. Signing back in will need a connection again.
    await forgetUnlock()
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

      // Open on the last known identity straight away, so a record that is already on this
      // device is readable with no network and no waiting.
      const remembered = await loadCachedUser<PublicUser>()
      if (remembered && !cancelled) {
        setUser(remembered)
        setStatus('signedIn')
      }

      try {
        const me = await fetchMe(token)
        if (cancelled) return
        setUser(me)
        setStatus('signedIn')
        await saveCachedUser(me)
      } catch (e) {
        if (cancelled) return

        // 401 is the server saying this token is no longer good, which is the one case that
        // should end the session. Anything else — offline, timeout, the backend down — says
        // nothing about the token, so being unreachable must not log anybody out.
        if (e instanceof ApiError && e.status === 401) {
          await clearToken()
          setUser(null)
          setStatus('signedOut')
          return
        }

        // Unreachable, and this device has never seen who the token belongs to. There is
        // nothing to show, so the sign-in screen is the honest answer.
        if (!remembered) setStatus('signedOut')
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
    const address = email.trim().toLowerCase()
    try {
      const res = await login(address, password)
      await saveToken(res.token)
      await saveCachedUser(res.user)
      // Only after the server has agreed. A verifier stored from an unchecked password would
      // let anyone's first guess become this phone's accepted password.
      await rememberUnlock(address, password)
      setUser(res.user)
      setStatus('signedIn')
    } catch (e) {
      // authApi reports both "no connection" and "timed out" as status 0. Every other status
      // is the server having answered, and an answer is never something to work around.
      const unreachable = e instanceof ApiError && e.status === 0
      if (!unreachable) throw e

      // The server cannot be asked. If this phone has signed this person in before and still
      // holds their session, their password can be checked here instead.
      const [ok, remembered, token] = await Promise.all([
        verifyUnlock(address, password),
        loadCachedUser<PublicUser>(),
        loadToken(),
      ])
      if (ok && remembered && token) {
        setUser(remembered)
        setStatus('signedIn')
        return
      }
      throw e
    }
  }, [])

  const signUp = useCallback<AuthValue['signUp']>(async (input) => {
    const res = await register({ ...input, email: input.email.trim().toLowerCase() })
    await saveToken(res.token)
    await saveCachedUser(res.user)
    await rememberUnlock(input.email, input.password)
    setUser(res.user)
    setStatus('signedIn')
  }, [])

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut }),
    [status, user, signIn, signUp, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}