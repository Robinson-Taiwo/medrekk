import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

export interface PhotoText {
  text: string;
  /** Where the image came from, so the screen can say what was read. */
  source: 'CAMERA' | 'LIBRARY';
  /** The file on this device. The image is never uploaded; this is for showing a thumbnail. */
  uri: string;
  /**
   * SHA-256 of the image bytes, hex, or undefined when it could not be computed.
   *
   * The picture stays on the phone. Sending only the hash means a clinician who later doubts
   * a document can be shown the patient's own copy and check it is byte-for-byte the one that
   * was attached — without MedRekk ever holding the image itself.
   */
  imageHash?: string;
}

/** Big enough for any phone photograph, small enough not to choke on base64 in memory. */
const MAX_HASHABLE_BYTES = 12_000_000;

async function hashImage(uri: string): Promise<string | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !('size' in info) || info.size > MAX_HASHABLE_BYTES) return undefined;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    // Lowercased deliberately: the server validates against a lowercase hex pattern.
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    return digest.toLowerCase();
  } catch {
    // A hash is a bonus, not a requirement. Losing it must never lose the document.
    return undefined;
  }
}

/**
 * Reading text from a photograph. ML Kit handles printed text well and handwriting poorly, so this
 * is for a printed result or report rather than a doctor's note. The model comes from Google Play
 * rather than being downloaded by the app.
 */
async function readText(uri: string): Promise<string> {
  const { recognizeText } = await import('expo-mlkit-ocr');
  const result = await recognizeText(uri);
  return (result.text ?? '').trim();
}

export async function captureFromCamera(): Promise<PhotoText | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('MedRekk needs permission to use the camera.');

  const picked = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;

  return {
    text: await readText(asset.uri),
    source: 'CAMERA',
    uri: asset.uri,
    imageHash: await hashImage(asset.uri),
  };
}

export async function captureFromLibrary(): Promise<PhotoText | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('MedRekk needs permission to open your photos.');

  const picked = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;

  return {
    text: await readText(asset.uri),
    source: 'LIBRARY',
    uri: asset.uri,
    imageHash: await hashImage(asset.uri),
  };
}
