import { getToken, notifyUnauthorized } from "@/services/session";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; issues?: { path: string; message: string }[] };
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT";
  body?: object;
  /** Ignored. Auth now comes from the saved token. Kept so older callers still compile. */
  actorId?: string;
  /** Ignored. See actorId. */
  role?: "PATIENT" | "HEALTH_WORKER";
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "NO_API_URL", "EXPO_PUBLIC_API_URL is not set.");

  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted ? "TIMEOUT" : "NETWORK",
      controller.signal.aborted ? "The server took too long to respond." : "Can't reach MedRekk right now.",
    );
  } finally {
    clearTimeout(timer);
  }

  const json: (T & ErrorBody) | null = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) notifyUnauthorized();
    const issue = json?.error?.issues?.[0];
    throw new ApiError(
      res.status,
      json?.error?.code ?? "UNKNOWN",
      issue ? `${issue.path}: ${issue.message}` : (json?.error?.message ?? "Request failed"),
    );
  }
  if (json === null) throw new ApiError(res.status, "EMPTY", "Unexpected empty response.");
  return json;
}