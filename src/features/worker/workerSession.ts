import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

const KEY = 'medrekk.workerSession';

export interface WorkerSession {
  token: string;
  patientName: string;
  medrekkCode: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'AWAITING_REQUEST';
  grantedUntil?: string;
}

let current: WorkerSession | null = null;
let restoreAttempted = false;
const listeners = new Set<() => void>();

/** Best effort. A failed write must never block the worker mid-visit. */
function persist(next: WorkerSession | null): void {
  const write = next ? SecureStore.setItemAsync(KEY, JSON.stringify(next)) : SecureStore.deleteItemAsync(KEY);
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
 * Brings an approved session back after the app was reloaded or killed. Android reclaims
 * memory from backgrounded apps aggressively on low-end phones, and losing an approved
 * access halfway through a visit would mean asking the patient to approve all over again.
 * The server stays the authority on whether it is still live.
 */
export async function restoreWorkerSession(): Promise<void> {
  if (restoreAttempted || current) return;
  restoreAttempted = true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as WorkerSession;
    if (!saved || typeof saved.token !== 'string' || saved.token.length === 0) return;

    current = saved;
    emit();

    // Imported lazily: workerApi imports this module, so a static import would cycle.
    const { accessStatus } = await import('./workerApi');
    const res = await accessStatus(saved.token);
    if (res.status === 'APPROVED' || res.status === 'PENDING') {
      patchWorkerSession({ status: res.status, grantedUntil: res.grantedUntil });
    } else {
      setWorkerSession(null);
    }
  } catch {
    // Nothing recoverable: the worker simply starts again from the patient lookup.
  }
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
