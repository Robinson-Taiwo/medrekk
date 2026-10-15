import { useCallback, useState } from 'react';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';

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
 * Recording and transcription, kept apart from the screen so the capture screen only deals in
 * stages and text. The audio file is a step on the way to text and is not kept afterwards.
 */
export function useVoiceCapture(): VoiceCapture {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
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
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage('RECORDING');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start recording.');
      setStage('IDLE');
    }
  }, [recorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (stage !== 'RECORDING') return null;
    setStage('TRANSCRIBING');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('The recording was not saved.');

      const { text } = await transcribeFile(uri);
      setStage('IDLE');
      // An empty transcript means nothing was heard, which is not an error worth alarming over.
      return text.length > 0 ? text : null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the recording.');
      setStage('IDLE');
      return null;
    }
  }, [recorder, stage]);

  const cancel = useCallback(async () => {
    if (stage === 'RECORDING') {
      try {
        await recorder.stop();
      } catch {
        // Nothing to recover: the recording is being thrown away anyway.
      }
    }
    setStage('IDLE');
    setError(null);
  }, [recorder, stage]);

  return { stage, error, start, stopAndTranscribe, cancel };
}
