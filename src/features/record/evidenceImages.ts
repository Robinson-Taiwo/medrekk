import * as FileSystem from 'expo-file-system/legacy';

/**
 * The patient's own copy of a document they photographed.
 *
 * MedRekk never uploads the image — only its SHA-256, so a clinician who doubts a document can be
 * shown the patient's copy and check it is byte-for-byte the one that was attached. That only
 * works if the copy survives, and until now it did not: ImagePicker hands back a URI inside the
 * app's *cache* directory, which both iOS and Android empty whenever they want the space. The
 * thumbnail worked in the minute after capture and the file was gone by the next week, leaving a
 * record that claimed to have a document behind it and could not produce one.
 *
 * Files live under documentDirectory, which is backed up and never reclaimed, and are named by
 * their own hash: the same picture attached twice costs one file, and a file is findable from an
 * encounter without storing a path anywhere.
 */

const DIR = `${FileSystem.documentDirectory}evidence/`;

/** Hex SHA-256, lowercase, as the server validates it. Anything else is not ours to open. */
const HASH = /^[a-f0-9]{64}$/;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

function pathFor(hash: string): string {
  return `${DIR}${hash}.jpg`;
}

/**
 * Keeps the picture. Returns the permanent path, or null if it could not be kept.
 *
 * Never throws. A document whose image could not be copied is still a document worth filing, and
 * the caller has already saved it by the time this runs.
 */
export async function keepImage(hash: string | undefined, fromUri: string): Promise<string | null> {
  if (!hash || !HASH.test(hash)) return null;
  try {
    await ensureDir();
    const to = pathFor(hash);
    const existing = await FileSystem.getInfoAsync(to);
    if (existing.exists) return to; // same bytes, same name — already held
    await FileSystem.copyAsync({ from: fromUri, to });
    return to;
  } catch {
    return null;
  }
}

/**
 * This handset's copy of a document, or null when it has none.
 *
 * Null is an ordinary answer rather than an error: signing in on a second phone gives you your
 * whole record and none of your pictures, because the pictures were never sent anywhere. The
 * screen says so instead of showing a broken frame.
 */
export async function localImageFor(hash: string | undefined): Promise<string | null> {
  if (!hash || !HASH.test(hash)) return null;
  try {
    const info = await FileSystem.getInfoAsync(pathFor(hash));
    return info.exists ? pathFor(hash) : null;
  } catch {
    return null;
  }
}

/** Sign-out. The record goes; the pictures of it should not outlive it on a shared handset. */
export async function forgetImages(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(DIR);
    if (info.exists) await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    // Nothing to clear, or no permission to. Not worth failing a sign-out over.
  }
}
