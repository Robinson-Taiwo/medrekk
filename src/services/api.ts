const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export async function api<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: object; actorId?: string; role?: "PATIENT" | "HEALTH_WORKER" } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      // DEV-ONLY until JWT auth exists:
      ...(options.actorId ? { "x-actor-id": options.actorId, "x-actor-role": options.role ?? "PATIENT" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw data;
  return data;
}