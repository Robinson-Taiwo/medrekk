import { initWhisper, type WhisperContext } from 'whisper.rn';

import { whisperPath } from './modelStore';
import { refreshWhisperStatus, useWhisperStatusSnapshot } from './whisperStore';

export interface Transcription {
  text: string;
  millis: number;
}

let context: WhisperContext | null = null;

/**
 * One context, kept alive between recordings. Loading it costs a second or two, and a worker
 * recording several notes in a row should not pay that each time.
 */
async function getContext(): Promise<WhisperContext> {
  if (context) return context;

  // Checked here rather than left to initWhisper, whose failure on a missing file is opaque.
  await refreshWhisperStatus(true);
  if (useWhisperStatusSnapshot().state !== 'READY') {
    throw new Error('The speech model is not installed. Open the Model tab to add it.');
  }

  context = await initWhisper({ filePath: whisperPath, useGpu: false });
  return context;
}

/** Turns a recorded file into text. The text then goes through the same seam as a typed note. */
export async function transcribeFile(uri: string): Promise<Transcription> {
  const started = Date.now();
  const ctx = await getContext();

  // The recorder hands back a bare absolute path; whisper.rn expects a file URL.
  const filePath = uri.startsWith('file://') ? uri : `file://${uri}`;

  // The English-only model is told so explicitly: left to detect, it sometimes decides a Nigerian
  // accent is another language and translates rather than transcribing.
  const { promise } = ctx.transcribe(filePath, { language: 'en', maxThreads: 4 });
  const result = await promise;

  return { text: (result.result ?? '').trim(), millis: Date.now() - started };
}

/** Called when the worker leaves the capture screen, so the model is not held in memory. */
export async function releaseVoice(): Promise<void> {
  if (!context) return;
  await context.release();
  context = null;
}
