/**
 * whisper.rn ships an `exports` map with no root entry, so TypeScript cannot reach its types from a
 * bare import even though `types` in its package.json points at them. Rather than change module
 * resolution for the whole project, the two things this app uses are declared here. The import
 * itself stays bare, so Metro resolves the real CommonJS build.
 */
declare module 'whisper.rn' {
  export interface TranscribeResult {
    result: string;
    segments: { text: string; t0: number; t1: number }[];
    isAborted?: boolean;
  }

  export interface TranscribeFileOptions {
    language?: string;
    maxThreads?: number;
    translate?: boolean;
    tokenTimestamps?: boolean;
    onProgress?: (progress: number) => void;
  }

  export class WhisperContext {
    transcribe(
      filePathOrBase64: string | number,
      options?: TranscribeFileOptions,
    ): { stop: () => Promise<void>; promise: Promise<TranscribeResult> };
    release(): Promise<void>;
  }

  export function initWhisper(options: {
    filePath: string | number;
    isBundleAsset?: boolean;
    useGpu?: boolean;
    useCoreMLIos?: boolean;
    useFlashAttn?: boolean;
  }): Promise<WhisperContext>;

  export function releaseAllWhisper(): Promise<void>;
}
