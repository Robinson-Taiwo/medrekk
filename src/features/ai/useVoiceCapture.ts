import { useCallback, useRef, useState } from 'react';
import { NativeModules } from 'react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import AudioRecord, { type AudioChunkSubscription } from '@fugood/react-native-audio-pcm-stream';

import { pcmFromChunks, pcmSeconds, type PcmFormat } from './pcmWav';
import { transcribePcm } from './voice';

export type VoiceStage = 'IDLE' | 'RECORDING' | 'TRANSCRIBING';

export interface VoiceCapture {
  stage: VoiceStage;
  error: string | null;
  start: () => Promise<void>;
  /** Stops, transcribes, and returns the text. Null when nothing usable came back. */
  stopAndTranscribe: () => Promise<string | null>;
  cancel: () => Promise<void>;
}

/**
 * Whisper decodes 16-bit PCM at 16 kHz, mono, and nothing else: compressed formats are not
 * decoded at all. expo-audio records AAC in an .m4a at 44.1 kHz stereo on Android, and
 * Android's MediaRecorder cannot emit WAV, so no preset could ever have worked. This recorder
 * delivers exactly the format whisper wants, straight from the microphone.
 */
const FORMAT: PcmFormat = { sampleRate: 16000, channels: 1 };

/**
 * bufferSize is deliberately absent. The native recorder discards its first two buffers to
 * remove the start-up click, so the buffer length is also how much of the first word is lost:
 * at the device minimum that is roughly 80ms, while an 8KB buffer would swallow half a second.
 */
const RECORDING = {
  ...FORMAT,
  bitsPerSample: 16,
  // Android VOICE_RECOGNITION: tuned for speech rather than music.
  audioSource: 6,
};

/**
 * stop() only clears the flag the recording thread watches. The thread can still emit one
 * more buffer, and it is what releases the microphone, so this much grace stops the last word
 * being cut off and stops a fresh init landing while the old thread is tearing its recorder
 * down underneath it.
 */
const SETTLE_MS = 250;

/** Shorter than this and there is nothing to transcribe but the tap itself. */
const MIN_SECONDS = 0.4;

/**
 * Whether the microphone can actually be opened on this install.
 *
 * The package's own wrapper is a plain object whose methods always exist — `init` is
 * `options => RNLiveAudioStream.init(options)` — so checking the wrapper proved nothing and
 * the earlier guard passed on every build. What is missing on an install made before the
 * package was added is the native module underneath, and the first sign of it was
 * "Cannot read property 'init' of null" on screen the moment someone tapped record.
 *
 * Checked at the only layer that tells the truth, and exported so a screen can leave the
 * option out rather than offer a button that fails.
 */
export function voiceAvailable(): boolean {
  return Boolean(NativeModules.RNLiveAudioStream);
}

const NO_NATIVE =
  'Speaking needs a newer build of MedRekk — this install does not have the microphone module. Use Type or Photo.';

function recorder(): typeof AudioRecord {
  if (!voiceAvailable()) throw new Error(NO_NATIVE);
  return AudioRecord;
}

/**
 * Native module rejections are not reliably Error instances, and when they are not the reason
 * was being thrown away — which is how a format failure reached a phone as "Could not read the
 * recording." Dig the message out of whatever shape arrived. Android's init rejects with a
 * bare string, which arrives as a code rather than a message.
 */
function describe(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.length > 0) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  if (e !== null && typeof e === 'object') {
    const shape = e as { message?: unknown; code?: unknown };
    const parts: string[] = [];
    if (typeof shape.message === 'string' && shape.message.length > 0) parts.push(shape.message);
    if (typeof shape.code === 'string' && shape.code.length > 0) parts.push(`(${shape.code})`);
    if (parts.length > 0) return parts.join(' ');
  }
  return fallback;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recording and transcription, kept apart from the screen so the capture screen only deals in
 * stages and text.
 *
 * The recorder streams the microphone as base64 PCM and writes no file, so the chunks are
 * collected here and assembled into a WAV in memory. The audio never reaches storage.
 */
export function useVoiceCapture(): VoiceCapture {
  const [stage, setStage] = useState<VoiceStage>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const chunks = useRef<string[]>([]);
  const subscription = useRef<AudioChunkSubscription | null>(null);

  const detach = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('MedRekk needs permission to use the microphone.');
        return;
      }

      const mic = recorder();
      // Awaited: init rejects when the device refuses the format, and left unawaited that
      // became an unhandled rejection while start() carried on against a null recorder.
      await mic.init(RECORDING);

      chunks.current = [];
      detach();
      subscription.current = mic.on('data', (chunk) => {
        chunks.current.push(chunk);
      });

      mic.start();
      setStage('RECORDING');
    } catch (e) {
      detach();
      setError(describe(e, 'Could not start recording.'));
      setStage('IDLE');
    }
  }, [detach]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (stage !== 'RECORDING') return null;
    setStage('TRANSCRIBING');
    try {
      recorder().stop();
      await wait(SETTLE_MS);
      detach();

      const collected = chunks.current;
      chunks.current = [];

      const pcm = pcmFromChunks(collected);
      if (pcmSeconds(pcm, FORMAT) < MIN_SECONDS) {
        throw new Error('That was too short to hear. Let it run a moment before tapping stop.');
      }

      const { text } = await transcribePcm(pcm, FORMAT);
      setStage('IDLE');
      // An empty transcript means nothing was heard, which is not an error worth alarming over.
      return text.length > 0 ? text : null;
    } catch (e) {
      setError(describe(e, 'Could not read the recording.'));
      setStage('IDLE');
      return null;
    }
  }, [detach, stage]);

  const cancel = useCallback(async () => {
    if (stage === 'RECORDING') {
      try {
        recorder().stop();
        // Waited through even though the audio is being discarded: the microphone is released
        // on that thread, and the next recording has to be able to claim it.
        await wait(SETTLE_MS);
      } catch {
        // Nothing to recover: the recording is being thrown away anyway.
      }
    }
    detach();
    chunks.current = [];
    setStage('IDLE');
    setError(null);
  }, [detach, stage]);

  return { stage, error, start, stopAndTranscribe, cancel };
}
