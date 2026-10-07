import NetInfo from "@react-native-community/netinfo";
import { api, ApiError } from "@/services/api";
import { readCache, writeCache } from "./cache";

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  savedAt: string | null;
}

function isConnectivityFailure(e: ApiError): boolean {
  return e.code === "NETWORK" || e.code === "TIMEOUT" || e.status >= 500;
}

export async function fetchWithCache<T>(key: string, path: string): Promise<CachedResult<T>> {
  const net = await NetInfo.fetch();
  if (net.isConnected === false || net.isInternetReachable === false) {
    const cached = await readCache<T>(key);
    if (cached) return { data: cached.value, fromCache: true, savedAt: cached.savedAt };
  }
  try {
    const data = await api<T>(path);
    await writeCache(key, data).catch(() => undefined);
    return { data, fromCache: false, savedAt: null };
  } catch (e) {
    if (e instanceof ApiError && isConnectivityFailure(e)) {
      const cached = await readCache<T>(key);
      if (cached) return { data: cached.value, fromCache: true, savedAt: cached.savedAt };
    }
    throw e;
  }
}
