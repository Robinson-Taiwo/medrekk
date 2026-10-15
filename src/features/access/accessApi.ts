import { api } from "@/services/api";
import type { AccessScope, RequesterRole } from "@/types/api";

export interface PendingAccessRequest {
  id: string;
  requester?: { name: string; role: RequesterRole; reason: string; facility?: string };
  requestedScopes: AccessScope[];
  durationMinutes?: number;
  expiresAt: string;
}

export interface ActiveAccessSession {
  id: string;
  status: string;
  requester?: { name: string; role: RequesterRole; reason: string; facility?: string };
  requestedScopes: AccessScope[];
  approvedScopes?: AccessScope[];
  grantedUntil?: string;
  decidedAt?: string;
  revokedAt?: string;
}

export const fetchPendingRequests = () => api<PendingAccessRequest[]>("/patients/me/access-requests");

export const fetchActiveAccess = () => api<ActiveAccessSession[]>("/patients/me/access-sessions?status=active");

export const revokeAccess = (sessionId: string) =>
  api<{ status: string; revokedAt?: string }>(`/patients/me/access-sessions/${sessionId}/revoke`, {
    method: "POST",
    body: {},
  });

export const decideAccess = (
  requestId: string,
  body: { decision: "APPROVE" | "DENY"; approvedScopes?: AccessScope[] },
) =>
  api<{ status: string; grantedUntil?: string }>(`/patients/me/access-requests/${requestId}/decision`, {
    method: "POST",
    body,
  });
