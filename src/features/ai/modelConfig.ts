export const MODEL_FILE = 'Qwen3-0.6B-Q4_K_M.gguf';
export const MODEL_URL = `https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/${MODEL_FILE}`;
export const MODEL_LABEL = 'Qwen3 0.6B (Q4_K_M)';
export const MODEL_APPROX_MB = 450;

/**
 * Speech to text. A separate, much smaller model from the language model above: the two do
 * different jobs and a worker may want one without the other.
 */
export const WHISPER_FILE = 'ggml-tiny.en-q5_1.bin';
export const WHISPER_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${WHISPER_FILE}`;
export const WHISPER_LABEL = 'Whisper tiny (English)';
export const WHISPER_APPROX_MB = 32;

export const formatMb = (bytes: number): string => `${Math.round(bytes / 1_000_000)} MB`;
