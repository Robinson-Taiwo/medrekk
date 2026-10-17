import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("medrekk-cache.db");
      // CREATE TABLE IF NOT EXISTS, so an install that predates a table picks it up on launch.
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS record_cache (
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          saved_at TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        );

        /*
         * Work recorded on this handset that the server has not accepted yet.
         *
         * syncQueue.ts has always read and written this table, but nothing ever created it,
         * so the first insert would have failed with "no such table" — which is one of the
         * reasons capturing a visit offline did not work.
         *
         * sync_status is PENDING, SYNCING, SYNCED or FAILED. A row is kept after SYNCED so a
         * reply lost on the way back does not cause the same visit to be sent as a new one.
         */
        CREATE TABLE IF NOT EXISTS sync_queue (
          operation_id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          retry_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS sync_queue_pending
          ON sync_queue (sync_status, created_at);
      `);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}
