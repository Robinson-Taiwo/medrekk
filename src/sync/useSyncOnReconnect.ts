import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSQLiteContext } from "expo-sqlite";
import { pushPending } from "./syncQueue";

export function useSyncOnReconnect(workerId: string | undefined): void {
  const db = useSQLiteContext(); // or pass your own db instance
  useEffect(() => {
    if (!workerId) return;
    const run = () => { void pushPending(db, workerId); };
    run();
    const unsubscribeNet = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) run();
    });
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active") run(); });
    const timer = setInterval(run, 60_000);
    return () => { unsubscribeNet(); appSub.remove(); clearInterval(timer); };
  }, [db, workerId]);
}