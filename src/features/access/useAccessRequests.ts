import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { AccessScope } from "@/types/api";
import { decideAccess, fetchPendingRequests, type PendingAccessRequest } from "./accessApi";

export function useAccessRequests() {
  const [requests, setRequests] = useState<PendingAccessRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await fetchPendingRequests());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Can't reach MedRekk right now.");
    }
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
    },
    [],
  );

  return { requests, error, decide };
}