import { api } from "@/services/api";
import type { VerificationStatus } from "@/types/api";

export interface VerificationEventView {
  id: string;
  claimId: string;
  verifierName: string;
  verifierFacility: string | null;
  method: string;
  previousStatus: VerificationStatus;
  resultingStatus: VerificationStatus;
  credentialApproved: boolean;
  verifiedAt: string;
}

export const fetchVerifications = () => api<VerificationEventView[]>("/patients/me/verifications");
