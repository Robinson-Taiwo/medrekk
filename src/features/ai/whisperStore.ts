import { useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { WHISPER_URL } from './modelConfig';
import { whisperPath } from './modelStore';

/**
 * The same shape as the language model's store, deliberately kept as a separate copy. Merging the
 * two would mean threading a model kind through every function and every caller, which is not a
 * change worth making close to a demo. Worth merging afterwards.
 */
export type WhisperState = 'UNKNOWN' | 'MISSING' | 'DOWNLOADING' | 'READY' | 'FAILED';

export interface WhisperStatus {
  state: WhisperState;
  bytesWritten: number;
  totalBytes: number;
  sizeOnDisk: number;
  error: string | null;
}

/** A partial download is the failure that matters: the file exists but whisper cannot load it. */
const MIN_BYTES = 20_000_000;

let status: WhisperStatus = {
  state: 'UNKNOWN',
  bytesWritten: 0,
  totalBytes: 0,
  sizeOnDisk: 0,
  error: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<WhisperStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}

export function useWhisperStatusSnapshot(): WhisperStatus {
  return status;
}

export function useWhisperStatus(): WhisperStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}

export async function refreshWhisperStatus(force = false): Promise<void> {
  if (status.state === 'DOWNLOADING' && !force) return;
  try {
    const info = await FileSystem.getInfoAsync(whisperPath);
    const size = info.exists && 'size' in info ? info.size : 0;
    if (info.exists && size > MIN_BYTES) {
      set({ state: 'READY', sizeOnDisk: size, error: null });
    } else if (info.exists) {
      set({
        state: 'FAILED',
        sizeOnDisk: size,
        error: `Only ${Math.round(size / 1_000_000)} MB arrived. Try again.`,
      });
    } else {
      set({ state: 'MISSING', sizeOnDisk: 0 });
    }
  } catch (e) {
    set({ state: 'FAILED', error: e instanceof Error ? e.message : 'Could not check for the model.' });
  }
}

export async function downloadWhisper(): Promise<void> {
  if (status.state === 'DOWNLOADING') return;
  set({ state: 'DOWNLOADING', bytesWritten: 0, totalBytes: 0, error: null });
  const task = FileSystem.createDownloadResumable(WHISPER_URL, whisperPath, {}, (progress) => {
    set({
      bytesWritten: progress.totalBytesWritten,
      totalBytes: progress.totalBytesExpectedToWrite,
    });
  });
  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error('The download did not complete.');
    await refreshWhisperStatus(true);
  } catch (e) {
    set({ state: 'FAILED', error: e instanceof Error ? e.message : 'The download failed.' });
    await refreshWhisperStatus(true);
  }
}

export async function deleteWhisper(): Promise<void> {
  try {
    await FileSystem.deleteAsync(whisperPath, { idempotent: true });
  } finally {
    set({ state: 'MISSING', sizeOnDisk: 0, bytesWritten: 0, totalBytes: 0, error: null });
  }
}
