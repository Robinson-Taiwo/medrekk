import { api } from "@/services/api";
import type { AccessScope, RequesterRole } from "@/types/api";

export interface PendingAccessRequest {
  id: string;
  requester?: { name: string; role: RequesterRole; reason: string };
  requestedScopes: AccessScope[];
  durationMinutes?: number;
  expiresAt: string;
}

export const fetchPendingRequests = () => api<PendingAccessRequest[]>("/patients/me/access-requests");

export const decideAccess = (
  requestId: string,
  body: { decision: "APPROVE" | "DENY"; approvedScopes?: AccessScope[] },
) =>
  api<{ status: string; grantedUntil?: string }>(`/patients/me/access-requests/${requestId}/decision`, {
    method: "POST",
    body,
  });