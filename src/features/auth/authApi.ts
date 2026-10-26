export type Role = 'PATIENT' | 'HEALTH_WORKER'

export const LICENCE_BODIES = ['MDCN', 'NMCN', 'PCN', 'MLSCN', 'OTHER'] as const
export type LicenceBody = (typeof LICENCE_BODIES)[number]

export interface LicenceClaim {
  body: LicenceBody
  number: string
  profession: string
  submittedAt: string
  documentId: string | null
}

export interface PublicUser {
  id: string
  email: string
  fullName: string
  role: Role
  patientId: string | null
  facility: string | null
  /** HEALTH_WORKER only. PENDING until somebody approves the licence. */
  credentialStatus?: 'PENDING' | 'APPROVED' | null
  /** What the worker says their registration is. Absent until they submit it. */
  licence?: LicenceClaim
  hasLicenceDocument?: boolean
  /** The number USSD recognises this account by. Null until the patient adds one. */
  phone: string | null
}

export interface AuthResponse {
  token: string
  user: PublicUser
}

interface ErrorBody {
  error?: { message?: string; issues?: { path: string; message: string }[] }
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const BASE = process.env.EXPO_PUBLIC_API_URL ?? ''
const TIMEOUT_MS = 10000

async function call<T>(path: string, body?: object, token?: string): Promise<T> {
  if (!BASE) throw new ApiError(0, 'EXPO_PUBLIC_API_URL is not set. Add it to .env and restart Expo with: npx expo start -c')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? `The server at ${BASE} took too long to respond.`
        : `Cannot reach the server at ${BASE}. Check your connection and try again.`,
    )
  } finally {
    clearTimeout(timer)
  }

  const json: (T & ErrorBody) | null = await res.json().catch(() => null)
  if (!res.ok) {
    const issue = json?.error?.issues?.[0]
    throw new ApiError(
      res.status,
      issue ? `${issue.path}: ${issue.message}` : (json?.error?.message ?? 'Something went wrong.'),
    )
  }
  if (!json) throw new ApiError(res.status, 'Unexpected empty response from the server.')
  return json
}

export const login = (email: string, password: string) =>
  call<AuthResponse>('/auth/login', { email, password })

export const register = (input: {
  email: string
  password: string
  fullName: string
  role: Role
  facility?: string
  phone?: string
}) => call<AuthResponse>('/auth/register', input)

export const fetchMe = (token: string) => call<PublicUser>('/auth/me', undefined, token)

export interface CredentialSubmission {
  body: LicenceBody
  number: string
  profession: string
  image?: { mime: 'image/jpeg' | 'image/png'; base64: string }
}

/** A health worker saying which register they are on, and showing the licence. */
export const submitCredential = (input: CredentialSubmission, token: string) =>
  call<PublicUser>('/auth/me/credential', input, token)

/**
 * A health worker turning on their own patient record. Returns a new token, because the old
 * one was minted before the account had a record and the patient endpoints read it from there.
 */
export const addOwnRecord = (token: string) =>
  call<AuthResponse>('/auth/me/patient-record', {}, token)
