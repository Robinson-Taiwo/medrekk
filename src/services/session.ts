import * as SecureStore from 'expo-secure-store'

const KEY = 'medrekk.token'
const USER_KEY = 'medrekk.user'
let cached: string | null = null
let onUnauthorized: (() => void) | null = null

export async function loadToken(): Promise<string | null> {
  cached = await SecureStore.getItemAsync(KEY)
  return cached
}

export const getToken = (): string | null => cached

/**
 * The signed-in user, kept beside the token so the app can open without a network.
 *
 * Without this, a token that was perfectly valid still sent the holder to the sign-in screen
 * the moment the backend could not be reached — and signing in needs the backend, so the app
 * locked its own user out exactly when it claims to be most useful.
 */
export async function loadCachedUser<T>(): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function saveCachedUser(user: unknown): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
  } catch {
    // Best effort: failing to cache must never block signing in.
  }
}

export async function saveToken(token: string): Promise<void> {
  cached = token
  await SecureStore.setItemAsync(KEY, token)
}

export async function clearToken(): Promise<void> {
  try {
    const { clearCache } = await import("@/offline/cache");
    await clearCache();
  } catch {
    // best effort: a failed wipe must never block sign-out
  }
  cached = null
  await SecureStore.deleteItemAsync(KEY)
  await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined)
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

/** api.ts calls this whenever the backend answers 401. */
export function notifyUnauthorized(): void {
  onUnauthorized?.()
}