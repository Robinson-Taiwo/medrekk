import { useCallback, useState } from 'react';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import AudioRecord from '@fugood/react-native-audio-pcm-stream';

import { transcribeFile } from './voice';

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
 * Android's MediaRecorder cannot emit WAV, so no preset could have worked. This recorder
 * writes exactly the format whisper wants, straight from the microphone.
 */
const RECORDING = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  // Android VOICE_RECOGNITION: tuned for speech rather than music.
  audioSource: 6,
  wavFile: 'medrekk-note.wav',
};

/**
 * Native module rejections are not reliably Error instances, and when they are not the
 * reason was being thrown away — which is how a format failure reached a phone as
 * "Could not read the recording." Dig the message out of whatever shape arrived.
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

/**
 * Recording and transcription, kept apart from the screen so the capture screen only deals
 * in stages and text. The audio file is a step on the way to text and is not kept.
 */
export function useVoiceCapture(): VoiceCapture {
  const [stage, setStage] = useState<VoiceStage>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('MedRekk needs permission to use the microphone.');
        return;
      }
      AudioRecord.init(RECORDING);
      AudioRecord.start();
      setStage('RECORDING');
    } catch (e) {
      setError(describe(e, 'Could not start recording.'));
      setStage('IDLE');
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (stage !== 'RECORDING') return null;
    setStage('TRANSCRIBING');
    try {
      const path = await AudioRecord.stop();
      if (!path || path.length === 0) throw new Error('The recording was not saved.');

      const { text } = await transcribeFile(path);
      setStage('IDLE');
      // An empty transcript means nothing was heard, which is not an error worth alarming over.
      return text.length > 0 ? text : null;
    } catch (e) {
      setError(describe(e, 'Could not read the recording.'));
      setStage('IDLE');
      return null;
    }
  }, [stage]);

  const cancel = useCallback(async () => {
    if (stage === 'RECORDING') {
      try {
        await AudioRecord.stop();
      } catch {
        // Nothing to recover: the recording is being thrown away anyway.
      }
    }
    setStage('IDLE');
    setError(null);
  }, [stage]);

  return { stage, error, start, stopAndTranscribe, cancel };
}
