/**
 * The package ships a .d.ts that declares the module under its upstream name
 * ("react-native-live-audio-stream"), so importing it by the published name resolves to
 * nothing. Declared here, as whisper.rn is, rather than importing an implicit any.
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
    /** File name for the WAV the recorder writes. */
    wavFile: string;
    bufferSize?: number;
  }

  export interface AudioRecordApi {
    init: (options: Options) => void;
    start: () => void;
    /** Resolves with the path of the written WAV file. */
    stop: () => Promise<string>;
    on: (event: 'data', callback: (base64Chunk: string) => void) => void;
  }

  const AudioRecord: AudioRecordApi;
  export default AudioRecord;
}
