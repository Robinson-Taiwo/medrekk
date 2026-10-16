import { initWhisper, type WhisperContext } from 'whisper.rn';

import { encodeBase64, pcmSeconds, wavFromPcm16, type PcmFormat } from './pcmWav';
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

/**
 * Turns recorded PCM into text.
 *
 * The audio is handed over as a base64 WAV rather than a file. The recorder writes no file
 * (see pcmWav.ts), and whisper.rn's decoder takes `data:audio/wav;base64,` through exactly
 * the same C++ path a file path takes — it parses the chunks, requires uncompressed PCM, and
 * resamples to 16 kHz itself.
 *
 * Nothing is written to storage on the way, so a spoken note about somebody's health leaves
 * no file behind for another app, a backup or a file picker to find.
 */
export async function transcribePcm(pcm: Uint8Array, format: PcmFormat): Promise<Transcription> {
  const started = Date.now();
  const ctx = await getContext();
  const wav = encodeBase64(wavFromPcm16(pcm, format));

  // The English-only model is told so explicitly: left to detect, it sometimes decides a
  // Nigerian accent is another language and translates rather than transcribing.
  const { promise } = ctx.transcribe(`data:audio/wav;base64,${wav}`, {
    language: 'en',
    maxThreads: 4,
  });
  const result = await promise;

  return { text: (result.result ?? '').trim(), millis: Date.now() - started };
}

export { pcmSeconds };

/** Called when the worker leaves the capture screen, so the model is not held in memory. */
export async function releaseVoice(): Promise<void> {
  if (!context) return;
  await context.release();
  context = null;
}
