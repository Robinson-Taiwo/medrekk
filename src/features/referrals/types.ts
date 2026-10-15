export interface ReferralItem {
  claimId: string;
  scope: string;
  value: string;
  status: string;
}

export interface Referral {
  id: string;
  shareId: string;
  status: string;
  destinationFacility?: string | null;
  reason: string;
  note?: string | null;
  items: ReferralItem[];
  createdAt: string;
  expiresAt: string;
}

export interface PickableClaim {
  id: string;
  category: string;
  value: string;
  status: string;
  source: string;
}

export const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: "Unverified",
  SELF_REPORTED: "Self-reported",
  EVIDENCE_BACKED: "Evidence-backed",
  CLINICALLY_VERIFIED: "Clinically verified",
};

export const BADGE: Record<string, { bg: string; text: string }> = {
  UNVERIFIED: { bg: "bg-gray-200", text: "text-gray-700" },
  SELF_REPORTED: { bg: "bg-amber-100", text: "text-amber-800" },
  EVIDENCE_BACKED: { bg: "bg-sky-100", text: "text-sky-800" },
  CLINICALLY_VERIFIED: { bg: "bg-emerald-100", text: "text-emerald-800" },
};

export const EXPIRY_OPTIONS: { days: number; label: string }[] = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(/\/+$/, "");

export const referralUrl = (shareId: string): string => `${WEB_URL}/referral/${shareId}`;

export const effectiveStatus = (r: Referral): "ACTIVE" | "REVOKED" | "EXPIRED" => {
  if (r.status === "REVOKED") return "REVOKED";
  if (r.status !== "ACTIVE" || Date.parse(r.expiresAt) <= Date.now()) return "EXPIRED";
  return "ACTIVE";
};

export const prettyCategory = (s: string): string => s.replace(/_/g, " ").toLowerCase();
