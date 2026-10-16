/**
 * The package ships a .d.ts that declares the module under its upstream name
 * ("react-native-live-audio-stream"), so importing it by the published name resolves to
 * nothing. Declared here, as whisper.rn is.
 *
 * The shipped types are also wrong about what the module does, and they cost real debugging
 * time, so this declaration follows the native sources rather than them:
 *
 *   - They declare `stop: () => Promise<string>`, implying a path to a recorded file.
 *     Android's `stop()` is `{ isRecording = false; }` with no Promise parameter and iOS's is
 *     `RCT_EXPORT_METHOD(stop)`. Neither returns anything, on either platform.
 *   - They declare `wavFile` as required. No file is written anywhere: Android's `init` reads
 *     only sampleRate, channels, bitsPerSample, audioSource and bufferSize, and `wavFile` is
 *     read by nothing. It is omitted below so nobody passes it expecting a file.
 *   - They declare `init: (options) => void`. Android's is `init(ReadableMap, Promise)` and
 *     rejects when the device refuses the format, so it must be awaited.
 *
 * The audio only ever arrives as base64 PCM on the `data` event. See pcmWav.ts.
 */
declare module '@fugood/react-native-audio-pcm-stream' {
  export interface Options {
    sampleRate: number;
    /** 1 for mono, 2 for stereo. */
    channels: number;
    /** 8 or 16. */
    bitsPerSample: number;
    /** Android AudioSource. 6 is VOICE_RECOGNITION. */
    audioSource?: number;
    /**
     * Raised to the device minimum if it is smaller. Leave it alone: the native recorder
     * throws away the first two buffers to kill the start-up click, so a large buffer
     * silently eats the beginning of the first word.
     */
    bufferSize?: number;
  }

  export interface AudioChunkSubscription {
    remove: () => void;
  }

  export interface AudioRecordApi {
    /** Creates the recorder. Rejects when the device will not record this format. */
    init: (options: Options) => Promise<void>;
    /** Returns nothing. The recording thread releases the device once stop() is called. */
    start: () => void;
    /** Returns nothing: it only clears the flag the recording thread is watching. */
    stop: () => void;
    /** Clears any previous listener for the event before adding this one. */
    on: (event: 'data', callback: (base64Chunk: string) => void) => AudioChunkSubscription;
  }

  const AudioRecord: AudioRecordApi;
  export default AudioRecord;
}
