import { useSyncExternalStore } from 'react';

export interface WorkerSession {
  token: string;
  patientName: string;
  medrekkCode: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'AWAITING_REQUEST';
  grantedUntil?: string;
}

let current: WorkerSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setWorkerSession(next: WorkerSession | null): void {
  current = next;
  emit();
}

export function patchWorkerSession(patch: Partial<WorkerSession>): void {
  if (!current) return;
  current = { ...current, ...patch };
  emit();
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
