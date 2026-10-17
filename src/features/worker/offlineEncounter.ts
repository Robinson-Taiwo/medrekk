import { randomUUID } from 'expo-crypto';

import { getDb } from '@/offline/db';
import { enqueueOperation, pushPending } from '@/sync/syncQueue';
import type { DraftItem } from './workerApi';

/**
 * A visit is written to this handset first and sent afterwards.
 *
 * It used to go the other way: the encounter was opened on the server before anything could
 * be reviewed, so a clinic with no network could not record a visit at all — the one place
 * the product claims to be useful. Writing locally first means the save always succeeds, and
 * the network only decides *when* the record catches up, never *whether* the work survives.
 *
 * The same path runs online and offline. There is no separate offline branch to rot unnoticed
 * between demos: if saving works at all, the queue works.
 */

export interface QueuedVisit {
  encounterId: string;
  accessToken: string;
  rawInput: string;
  captureMethod: string;
  items: DraftItem[];
}

/**
 * The encounter is given its identity here rather than by the server, so the visit is the
 * same visit whether it syncs in four seconds or tomorrow — and a retry that the handset
 * never heard the answer to is recognised instead of filed twice.
 */
export function newEncounterId(): string {
  return `enc_${randomUUID()}`;
}

export async function queueVisit(visit: QueuedVisit): Promise<void> {
  const db = await getDb();
  await enqueueOperation(db, {
    entityType: 'encounters',
    entityId: visit.encounterId,
    operation: 'CREATE',
    payload: {
      accessToken: visit.accessToken,
      rawInput: visit.rawInput,
      captureMethod: visit.captureMethod,
      items: visit.items as unknown as Record<string, unknown>[],
    } as never,
  });
}

/** Visits recorded here that the record has not accepted yet. */
export async function pendingVisitCount(): Promise<number> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_queue
       WHERE entity_type = 'encounters' AND sync_status IN ('PENDING', 'SYNCING', 'FAILED')`,
    );
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Drops a queued visit that was never meant to be kept. */
export async function removeQueuedVisit(encounterId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      `DELETE FROM sync_queue WHERE entity_id = ? AND sync_status != 'SYNCED'`,
      [encounterId],
    );
  } catch {
    // The visit stays queued and syncs. Losing the discard is far better than losing a record.
  }
}

/** Best effort: if there is a connection the queue empties now, otherwise it waits. */
export async function syncNow(workerId: string): Promise<void> {
  try {
    const db = await getDb();
    await pushPending(db, workerId);
  } catch {
    // pushPending keeps everything queued on failure; the reconnect watcher tries again.
  }
}
