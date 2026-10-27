import { getDb } from '@/offline/db';

/**
 * Whether this person has already been shown the way around.
 *
 * Kept in the local database rather than on the server: a tour is a fact about this handset and
 * this person, nobody else needs it, and asking the network whether to show it would mean the
 * first screen after sign-in waits on a request that may never come back.
 *
 * Keyed by user id and deliberately NOT cleared on sign-out. Signing out and back in is not a
 * reason to be taught the app again, while a different account on the same phone — a second
 * person at a demo, a shared handset in a clinic — is a different person, and gets it.
 */

export async function hasSeenTour(userId: string, tour: string): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ seen_at: string }>(
      'SELECT seen_at FROM tour_seen WHERE user_id = ? AND tour = ?',
      [userId, tour],
    );
    return row !== null && row !== undefined;
  } catch {
    // A database that will not open must not block the app. Treating it as "seen" rather than
    // "not seen" is the kinder failure: a tour that never appears is a missing nicety, one that
    // appears on every launch is the app being broken at you.
    return true;
  }
}

export async function markTourSeen(userId: string, tour: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO tour_seen (user_id, tour, seen_at) VALUES (?, ?, ?)', [
      userId,
      tour,
      new Date().toISOString(),
    ]);
  } catch {
    // Worst case it is shown once more.
  }
}

/** For a "show me again" control, and for testing on a handset that has already seen it. */
export async function forgetTours(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM tour_seen WHERE user_id = ?', [userId]);
  } catch {
    // Nothing to forget.
  }
}
