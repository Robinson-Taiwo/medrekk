import { getToken } from "@/services/session";
import { getDb } from "./db";

export interface CachedValue<T> {
  value: T;
  savedAt: string;
}

function currentUserId(): string | null {
  const token = getToken();
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function readCache<T>(key: string): Promise<CachedValue<T> | null> {
  const userId = currentUserId();
  if (!userId) return null;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string; saved_at: string }>(
    "SELECT value, saved_at FROM record_cache WHERE user_id = ? AND key = ?",
    [userId, key],
  );
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value) as T, savedAt: row.saved_at };
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const userId = currentUserId();
  if (!userId) return;
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO record_cache (user_id, key, value, saved_at) VALUES (?, ?, ?, ?)",
    [userId, key, JSON.stringify(value), new Date().toISOString()],
  );
}

export async function clearCache(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM record_cache");
}
