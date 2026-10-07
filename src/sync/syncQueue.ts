import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import { api } from "@/services/api";
import type { SyncOperation, SyncResultStatus } from "@/types/api";

interface QueueRow {
  operation_id: string;
  entity_type: SyncOperation["entityType"];
  entity_id: string;
  operation: SyncOperation["operation"];
  payload: string;
  created_at: string;
}
interface SyncPushResponse {
  results: { operationId: string; status: SyncResultStatus }[];
}

const BATCH_SIZE = 100;
const MAX_RETRIES = 10;
let running = false;

/** Call this in the SAME transaction as the data write, so the record and its queue row are saved together. */
export async function enqueueOperation(
  db: SQLiteDatabase,
  op: Omit<SyncOperation, "operationId" | "createdAt">,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (operation_id, entity_type, entity_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), op.entityType, op.entityId, op.operation, JSON.stringify(op.payload), new Date().toISOString()],
  );
}

async function markStatus(db: SQLiteDatabase, ids: string[], status: string): Promise<void> {
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(`UPDATE sync_queue SET sync_status = ? WHERE operation_id IN (${placeholders})`, [status, ...ids]);
}

export async function pushPending(db: SQLiteDatabase, workerId: string): Promise<void> {
  if (running) return; // never run two syncs at once
  running = true;
  try {
    // anything left SYNCING means the app died mid-request
    await db.runAsync(`UPDATE sync_queue SET sync_status = 'PENDING' WHERE sync_status = 'SYNCING'`);

    for (;;) {
      const rows = await db.getAllAsync<QueueRow>(
        `SELECT operation_id, entity_type, entity_id, operation, payload, created_at
         FROM sync_queue
         WHERE sync_status IN ('PENDING', 'FAILED') AND retry_count < ?
         ORDER BY created_at ASC LIMIT ?`,
        [MAX_RETRIES, BATCH_SIZE],
      );
      if (rows.length === 0) return;

      const ids = rows.map((r) => r.operation_id);
      await markStatus(db, ids, "SYNCING");

      const operations: SyncOperation[] = rows.map((r) => ({
        operationId: r.operation_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        operation: r.operation,
        payload: JSON.parse(r.payload) as SyncOperation["payload"],
        createdAt: r.created_at,
      }));

      let response: SyncPushResponse;
      try {
        response = await api<SyncPushResponse>("/sync/push", {
          method: "POST",
          body: { operations },
          actorId: workerId,
          role: "HEALTH_WORKER",
        });
      } catch {
        await markStatus(db, ids, "PENDING"); // offline or server down: keep everything, retry later
        return;
      }

      let anyFailed = false;
      for (const r of response.results) {
        if (r.status === "FAILED") {
          anyFailed = true;
          await db.runAsync(
            `UPDATE sync_queue SET sync_status = 'FAILED', retry_count = retry_count + 1 WHERE operation_id = ?`,
            [r.operationId],
          );
        } else {
          await markStatus(db, [r.operationId], "SYNCED"); // SYNCED and DUPLICATE both mean "server has it"
        }
      }
      if (anyFailed || rows.length < BATCH_SIZE) return; // failed ones wait for the next trigger
    }
  } finally {
    running = false;
  }
}