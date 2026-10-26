import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

/**
 * Per account, not per handset.
 *
 * A single shared key meant the next person to sign in on the same phone inherited whatever
 * grant the last one left behind. Scoping the key to the worker's user id fixes that without
 * throwing the grant away, which is what the previous fix did.
 */
const keyFor = (userId: string) => `medrekk.workerSession.${userId}`;

export interface WorkerSession {
  token: string;
  patientName: string;
  medrekkCode: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'AWAITING_REQUEST';
  grantedUntil?: string;
  /** Server id for the grant, so it can be picked up again on another device. */
  sessionId?: string;
}

let current: WorkerSession | null = null;
let ownerId: string | null = null;
let restoringFor: string | null = null;
const listeners = new Set<() => void>();

/** Best effort. A failed write must never block the worker mid-visit. */
function persist(next: WorkerSession | null): void {
  if (!ownerId) return;
  const key = keyFor(ownerId);
  const write = next ? SecureStore.setItemAsync(key, JSON.stringify(next)) : SecureStore.deleteItemAsync(key);
  void write.catch(() => undefined);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setWorkerSession(next: WorkerSession | null): void {
  current = next;
  emit();
  persist(next);
}

export function patchWorkerSession(patch: Partial<WorkerSession>): void {
  if (!current) return;
  current = { ...current, ...patch };
  emit();
  persist(current);
}

/**
 * Brings an approved grant back, from this phone first and from the server second.
 *
 * The device copy is only a cache. The grant itself belongs to the worker's account, so a
 * worker who signed out, reinstalled, or picked up a different handset gets it back here —
 * which is what used to force them to ask the patient for access the patient had already
 * given, and could still see running on their own phone.
 *
 * The server is always the authority on whether it is still live.
 */
export function attachWorkerAccount(userId: string): void {
  if (ownerId === userId) return;
  // A different account on the same handset must not inherit the one before it.
  if (ownerId !== null && current !== null) {
    current = null;
    emit();
  }
  ownerId = userId;
}

export async function restoreWorkerSession(userId: string | undefined): Promise<void> {
  if (!userId) return;
  attachWorkerAccount(userId);
  if (current || restoringFor === userId) return;
  restoringFor = userId;

  const { accessStatus, myAccessSessions, resumeAccess } = await import('./workerApi');

  // 1. This phone. Shown straight away: the grant is already here, and waiting for the
  //    server to agree before showing it is what made a worker think it had vanished.
  let cached: WorkerSession | null = null;
  try {
    const raw = await SecureStore.getItemAsync(keyFor(userId));
    if (raw) {
      const saved = JSON.parse(raw) as WorkerSession;
      if (saved && typeof saved.token === 'string' && saved.token.length > 0) {
        cached = saved;
        current = saved;
        emit();
      }
    }
  } catch {
    // Unreadable storage is not fatal; the server copy below is the real one.
  }

  try {
    if (cached) {
      const res = await accessStatus(cached.token);
      if (res.status === 'APPROVED' || res.status === 'PENDING') {
        patchWorkerSession({ status: res.status, grantedUntil: res.grantedUntil });
        restoringFor = null;
        return;
      }
      // Over, or the token was rotated by a pick-up elsewhere. Fall through and ask properly.
      current = null;
      emit();
    }

    // 2. The account. Any grant this worker still holds, on whatever device it was approved.
    const mine = await myAccessSessions();
    const live = mine[0];
    if (!live) {
      setWorkerSession(null);
      restoringFor = null;
      return;
    }
    const picked = await resumeAccess(live.id);
    setWorkerSession({
      token: picked.session,
      patientName: picked.patientName,
      medrekkCode: picked.medrekkCode,
      status: picked.status as WorkerSession['status'],
      grantedUntil: picked.grantedUntil,
      sessionId: live.id,
    });
  } catch {
    // Could not ask. Anything cached stays on screen, and this is allowed to run again rather
    // than one failed check costing the worker their access until the app restarts.
  } finally {
    restoringFor = null;
  }
}

/**
 * Forgets this phone's copy. The grant itself is left running on the server, where it belongs
 * to the worker's account and to the patient who approved it.
 *
 * Signing out used to call release(), which ended the grant outright — so a worker who logged
 * out mid-shift destroyed access the patient had given them for two hours, and when the
 * release failed (offline, most of the time) the patient was left looking at an access no
 * device could open. Ending a grant is now only ever something a person chooses to do.
 */
export function forgetWorkerSessionOnThisDevice(): void {
  const key = ownerId ? keyFor(ownerId) : null;
  current = null;
  ownerId = null;
  restoringFor = null;
  emit();
  if (key) void SecureStore.deleteItemAsync(key).catch(() => undefined);
}

/** The token this phone holds, for handing the grant back. */
export function currentWorkerToken(): string | null {
  return current?.token ?? null;
}

export function useWorkerSession(): WorkerSession | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
