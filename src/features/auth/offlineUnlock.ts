import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

/**
 * Lets a phone that has signed in before check a password with no network.
 *
 * The password itself is never kept. What is stored is a verifier: a random salt and the
 * result of hashing the password with it many times over. The same password produces the
 * same verifier, a different one does not, and the verifier cannot be turned back into the
 * password without guessing.
 *
 * The real boundary here is SecureStore — the Android keystore and the iOS keychain — which
 * is where the session token already lives. The iterations exist for one specific danger: if
 * the verifier ever leaked, a cheap hash would let somebody recover a password the person has
 * probably reused somewhere else. They are not a substitute for the server's bcrypt, which
 * still decides whether an account actually exists.
 *
 * Known limit: the token is stored beside this rather than encrypted with a key derived from
 * the password, because there is no AES in expo-crypto and adding a cipher means another
 * native build. Encrypting it would mean a stolen phone's token was useless without the
 * password; today it is only as safe as the keystore. Worth doing, not worth doing badly.
 */

const KEY = 'medrekk.unlock'
const ITERATIONS = 1000

interface StoredUnlock {
  email: string
  salt: string
  verifier: string
  iterations: number
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

async function derive(password: string, salt: string, iterations: number): Promise<string> {
  let digest = `${salt}:${password}`
  for (let i = 0; i < iterations; i += 1) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest)
  }
  return digest
}

/** Compared without an early exit, so the time taken says nothing about how much matched. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function read(): Promise<StoredUnlock | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    return raw ? (JSON.parse(raw) as StoredUnlock) : null
  } catch {
    return null
  }
}

/** Called after the server has confirmed the password, never before. */
export async function rememberUnlock(email: string, password: string): Promise<void> {
  try {
    const salt = toHex(Crypto.getRandomBytes(16))
    const verifier = await derive(password, salt, ITERATIONS)
    const record: StoredUnlock = {
      email: email.trim().toLowerCase(),
      salt,
      verifier,
      iterations: ITERATIONS,
    }
    await SecureStore.setItemAsync(KEY, JSON.stringify(record))
  } catch {
    // Being unable to remember only costs an offline sign-in later. It must never block one
    // that is working right now.
  }
}

/** Whether this phone could check that address at all, used to word the screen honestly. */
export async function knowsAccount(email: string): Promise<boolean> {
  const record = await read()
  return record !== null && record.email === email.trim().toLowerCase()
}

export async function verifyUnlock(email: string, password: string): Promise<boolean> {
  const record = await read()
  if (!record || record.email !== email.trim().toLowerCase()) return false
  const candidate = await derive(password, record.salt, record.iterations)
  return sameString(candidate, record.verifier)
}

export async function forgetUnlock(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Nothing to clear.
  }
}
