import { useSyncExternalStore } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { MODEL_FILE, WHISPER_FILE, MODEL_URL } from './modelConfig';

export type ModelState = 'UNKNOWN' | 'MISSING' | 'DOWNLOADING' | 'READY' | 'FAILED';

export interface ModelStatus {
  state: ModelState;
  bytesWritten: number;
  totalBytes: number;
  sizeOnDisk: number;
  error: string | null;
}

export const modelPath = `${FileSystem.documentDirectory ?? ''}${MODEL_FILE}`;
/** The speech model sits beside the language model, downloaded and deleted independently. */
export const whisperPath = `${FileSystem.documentDirectory ?? ''}${WHISPER_FILE}`;

let status: ModelStatus = {
  state: 'UNKNOWN',
  bytesWritten: 0,
  totalBytes: 0,
  sizeOnDisk: 0,
  error: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<ModelStatus>): void {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}

/** Reads the current status outside React, for code paths that must not see a stale render value. */
export function useModelStatusSnapshot(): ModelStatus {
  return status;
}

export function useModelStatus(): ModelStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
    () => status,
  );
}

/** Reads the file from disk. Pass force to check even while a download is in flight. */
export async function refreshModelStatus(force = false): Promise<void> {
  if (status.state === 'DOWNLOADING' && !force) return;
  try {
    const info = await FileSystem.getInfoAsync(modelPath);
    const size = info.exists && 'size' in info ? info.size : 0;
    if (info.exists && size > 100_000_000) {
      set({ state: 'READY', sizeOnDisk: size, error: null });
    } else if (info.exists) {
      set({ state: 'FAILED', sizeOnDisk: size, error: `Only ${Math.round(size / 1_000_000)} MB arrived. Try again.` });
    } else {
      set({ state: 'MISSING', sizeOnDisk: 0 });
    }
  } catch (e) {
    set({ state: 'FAILED', error: e instanceof Error ? e.message : 'Could not check for the model.' });
  }
}

export async function downloadModel(): Promise<void> {
  if (status.state === 'DOWNLOADING') return;
  set({ state: 'DOWNLOADING', bytesWritten: 0, totalBytes: 0, error: null });
  const task = FileSystem.createDownloadResumable(MODEL_URL, modelPath, {}, (progress) => {
    set({
      bytesWritten: progress.totalBytesWritten,
      totalBytes: progress.totalBytesExpectedToWrite,
    });
  });
  try {
    const result = await task.downloadAsync();
    if (!result) throw new Error('The download did not complete.');
    await refreshModelStatus(true);
  } catch (e) {
    set({ state: 'FAILED', error: e instanceof Error ? e.message : 'The download failed.' });
    await refreshModelStatus(true);
  }
}

export async function deleteModel(): Promise<void> {
  try {
    await FileSystem.deleteAsync(modelPath, { idempotent: true });
  } finally {
    set({ state: 'MISSING', sizeOnDisk: 0, bytesWritten: 0, totalBytes: 0, error: null });
  }
}
