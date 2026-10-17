import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { getDb } from "@/offline/db";
import { pushPending } from "./syncQueue";

/**
 * Empties the queue whenever a connection appears, the app returns to the foreground, or a
 * minute goes by.
 *
 * This took its database from useSQLiteContext(), which needs an <SQLiteProvider> that was
 * never mounted anywhere — so the hook could not be called without crashing, and nothing
 * called it. Work captured offline would have sat in the queue forever. It now opens the same
 * database the rest of the offline code uses.
 */
export function useSyncOnReconnect(workerId: string | undefined): void {
  useEffect(() => {
    if (!workerId) return;
    let cancelled = false;

    const run = (): void => {
      void (async () => {
        try {
          const db = await getDb();
          if (!cancelled) await pushPending(db, workerId);
        } catch {
          // pushPending keeps every row on failure. The next trigger tries again.
        }
      })();
    };

    run();
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) run();
    });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    const timer = setInterval(run, 60_000);

    return () => {
      cancelled = true;
      unsubscribeNet();
      appSub.remove();
      clearInterval(timer);
    };
  }, [workerId]);
}
