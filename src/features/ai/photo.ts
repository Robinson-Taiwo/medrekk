import * as ImagePicker from 'expo-image-picker';

export interface PhotoText {
  text: string;
  /** Where the image came from, so the screen can say what was read. */
  source: 'CAMERA' | 'LIBRARY';
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

  const picked = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
  if (picked.canceled || !picked.assets[0]) return null;

  return { text: await readText(picked.assets[0].uri), source: 'CAMERA' };
}

export async function captureFromLibrary(): Promise<PhotoText | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('MedRekk needs permission to open your photos.');

  const picked = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false });
  if (picked.canceled || !picked.assets[0]) return null;

  return { text: await readText(picked.assets[0].uri), source: 'LIBRARY' };
}
