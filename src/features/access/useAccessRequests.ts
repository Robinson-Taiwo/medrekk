import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { fetchWithCache } from "@/offline/cachedFetch";
import type { AccessScope } from "@/types/api";
import {
  decideAccess,
  fetchPendingRequests,
  revokeAccess,
  type ActiveAccessSession,
  type PendingAccessRequest,
} from "./accessApi";

export function useAccessRequests() {
  const [requests, setRequests] = useState<PendingAccessRequest[]>([]);
  const [active, setActive] = useState<ActiveAccessSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Who can see the record is cached; who is asking right now is not.
   *
   * A live grant is a fact about the account that stays true offline, and it is one of the few
   * things a patient may urgently want to check with no signal — it also carries grantedUntil,
   * so a stale row that has since lapsed displays as expired rather than as access.
   *
   * A pending request lives for a few minutes and is answered over the network. Serving one from
   * cache would show somebody a decision they cannot make, and possibly one already made.
   */
  const load = useCallback(async () => {
    const running = fetchWithCache<ActiveAccessSession[]>(
      "access-active",
      "/patients/me/access-sessions?status=active",
    )
      .then((r) => {
        setActive(r.data);
        return true;
      })
      .catch(() => false);

    const pending = fetchPendingRequests()
      .then((list) => {
        setRequests(list);
        return true;
      })
      .catch(() => {
        setRequests([]);
        return false;
      });

    const [gotActive, gotPending] = await Promise.all([running, pending]);
    setError(gotActive || gotPending ? null : "Can't reach MedRekk right now.");
  }, []);

  // poll only while this screen is focused
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 5000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const decide = useCallback(
    async (id: string, decision: "APPROVE" | "DENY", approvedScopes?: AccessScope[]) => {
      await decideAccess(id, { decision, approvedScopes });
      setRequests((prev) => prev.filter((r) => r.id !== id));
      void load();
    },
    [load],
  );

  const endAccess = useCallback(
    async (id: string) => {
      await revokeAccess(id);
      setActive((prev) => prev.filter((s) => s.id !== id));
      void load();
    },
    [load],
  );

  return { requests, active, error, decide, endAccess };
}
