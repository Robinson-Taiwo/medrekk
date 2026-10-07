import * as SecureStore from 'expo-secure-store'

const KEY = 'medrekk.token'
let cached: string | null = null
let onUnauthorized: (() => void) | null = null

export async function loadToken(): Promise<string | null> {
  cached = await SecureStore.getItemAsync(KEY)
  return cached
}

export const getToken = (): string | null => cached

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
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

/** api.ts calls this whenever the backend answers 401. */
export function notifyUnauthorized(): void {
  onUnauthorized?.()
}