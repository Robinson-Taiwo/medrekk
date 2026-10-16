/**
 * Assembles a WAV from the recorder's PCM stream.
 *
 * The Android recorder writes no file at any point: its stop() takes no promise and
 * returns void, and the wavFile option it is given is read by nothing. The audio exists
 * only as the base64 chunks the data event delivers, so the file whisper reads has to be
 * built here.
 *
 * Nothing touches storage. A spoken note about somebody's health never becomes a file that
 * another app, a cloud backup or a file picker could reach: it goes from the microphone to
 * the model as bytes in memory, and is dropped once there is text.
 */

export interface PcmFormat {
  sampleRate: number;
  channels: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Reverse lookup, built once. 255 marks a character that is not base64 at all. */
const REVERSE = ((): Uint8Array => {
  const table = new Uint8Array(256).fill(255);
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/**
 * Hand-rolled rather than taken from a package: Buffer is not global in React Native, and
 * base64-js is only in node_modules as somebody else's transitive dependency. Neither is a
 * thing to discover is missing during a demo.
 */
function decodeBase64(encoded: string): Uint8Array {
  // Counted first so the output is allocated exactly once.
  let count = 0;
  for (let i = 0; i < encoded.length; i += 1) {
    const code = encoded.charCodeAt(i);
    if (code < 256 && REVERSE[code] !== 255) count += 1;
  }

  const out = new Uint8Array((count * 3) >> 2);
  let at = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < encoded.length; i += 1) {
    const code = encoded.charCodeAt(i);
    const value = code < 256 ? REVERSE[code]! : 255;
    if (value === 255) continue; // padding and any stray whitespace
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at] = (acc >> bits) & 0xff;
      at += 1;
    }
  }
  return out;
}

export function encodeBase64(bytes: Uint8Array): string {
  // Built in slices: a single million-character concatenation thrashes, and
  // String.fromCharCode cannot be handed a million arguments at once. The slice length is a
  // multiple of 3 so no slice ever splits a triplet, which keeps the padding to the real end.
  const parts: string[] = [];
  const SLICE = 3 * 1024;

  for (let start = 0; start < bytes.length; start += SLICE) {
    const end = Math.min(start + SLICE, bytes.length);
    let text = '';
    let i = start;
    for (; i + 2 < end; i += 3) {
      const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
      text +=
        ALPHABET[(n >> 18) & 63]! +
        ALPHABET[(n >> 12) & 63]! +
        ALPHABET[(n >> 6) & 63]! +
        ALPHABET[n & 63]!;
    }
    const left = end - i;
    if (left === 1) {
      const n = bytes[i]! << 16;
      text += `${ALPHABET[(n >> 18) & 63]!}${ALPHABET[(n >> 12) & 63]!}==`;
    } else if (left === 2) {
      const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
      text += `${ALPHABET[(n >> 18) & 63]!}${ALPHABET[(n >> 12) & 63]!}${ALPHABET[(n >> 6) & 63]!}=`;
    }
    parts.push(text);
  }

  return parts.join('');
}

/**
 * Each chunk is decoded on its own and the bytes are joined. Joining the base64 strings
 * instead would corrupt the audio: that only works where every chunk's byte length divides
 * by 3, and the recorder's buffer size is whatever the device's minimum happens to be.
 */
export function pcmFromChunks(chunks: string[]): Uint8Array {
  const decoded = chunks.map(decodeBase64);
  let total = 0;
  for (const part of decoded) total += part.length;

  const pcm = new Uint8Array(total);
  let at = 0;
  for (const part of decoded) {
    pcm.set(part, at);
    at += part.length;
  }
  return pcm;
}

export function pcmSeconds(pcm: Uint8Array, format: PcmFormat): number {
  const bytesPerSecond = format.sampleRate * format.channels * 2;
  return bytesPerSecond === 0 ? 0 : pcm.length / bytesPerSecond;
}

/**
 * A canonical 44-byte header. whisper.rn's decoder walks the chunks properly, but it does
 * insist on audioFormat 1, so this stays uncompressed PCM.
 */
export function wavFromPcm16(pcm: Uint8Array, format: PcmFormat): Uint8Array {
  const { sampleRate, channels } = format;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);

  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) out[offset + i] = text.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true); // every byte after this field
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // a PCM fmt chunk is 16 bytes
  view.setUint16(20, 1, true); // 1 = PCM. Anything else is rejected outright.
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);

  return out;
}
