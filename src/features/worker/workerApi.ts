import { api } from '@/services/api';

export const CLAIM_CATEGORIES = [
  'ALLERGIES',
  'CURRENT_MEDICATIONS',
  'RECENT_ENCOUNTERS',
  'PAST_MEDICAL_HISTORY',
  'LAB_RESULTS',
] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  ALLERGIES: 'Allergies',
  CURRENT_MEDICATIONS: 'Current medications',
  RECENT_ENCOUNTERS: 'Recent encounters',
  PAST_MEDICAL_HISTORY: 'Past medical history',
  LAB_RESULTS: 'Lab results',
};

export interface DraftItem {
  category: ClaimCategory;
  value: string;
  excerpt?: string;
}

export interface Encounter {
  id: string;
  rawInput: string;
  draft: DraftItem[];
  draftSource: 'AI' | 'WORKER' | null;
  status: 'CAPTURED' | 'STRUCTURED' | 'REVIEWED';
  createdClaimIds: string[];
}

interface LookupResponse {
  session: string;
  patientName: string;
  medrekkCode: string;
}

export const lookupPatient = (medrekkCode: string, patientName: string) =>
  api<LookupResponse>('/access/lookup', { method: 'POST', body: { medrekkCode, patientName } });

export const requestAccess = (
  token: string,
  body: { requesterName: string; requesterRole: string; reason: string; scopes: string[]; durationMinutes: number },
) => api<{ status: string }>(`/access/${token}/request`, { method: 'POST', body });

/** Hands the grant back, so the patient stops being shown access nobody is using. */
export const releaseAccess = (token: string) =>
  api<{ status: string }>(`/access/${token}/release`, { method: 'POST' });

export interface HeldAccess {
  id: string;
  status: 'PENDING' | 'APPROVED';
  patientName: string;
  medrekkCode: string;
  approvedScopes: string[];
  grantedUntil?: string;
}

/**
 * Grants this worker account is still holding, wherever they were approved. Keyed on the
 * account, so signing out, reinstalling or changing phone no longer loses them.
 */
export const myAccessSessions = () => api<HeldAccess[]>('/access/mine');

/** Picks a held grant back up on this device, as a fresh token. */
export const resumeAccess = (id: string) =>
  api<{ session: string; status: string; patientName: string; medrekkCode: string; grantedUntil?: string }>(
    `/access/mine/${id}/resume`,
    { method: 'POST' },
  );

export const accessStatus = (token: string) =>
  api<{ status: string; grantedUntil?: string }>(`/access/${token}/status`);

export const captureEncounter = (token: string, rawInput: string) =>
  api<Encounter>(`/access/${token}/encounters`, {
    method: 'POST',
    body: { rawInput, captureMethod: 'TEXT' },
  });

export const saveDraft = (token: string, id: string, items: DraftItem[], source: 'AI' | 'WORKER') =>
  api<Encounter>(`/access/${token}/encounters/${id}/draft`, { method: 'POST', body: { source, items } });

export const discardEncounter = (token: string, id: string) =>
  api<Encounter>(`/access/${token}/encounters/${id}/discard`, { method: 'POST' });

export const reviewEncounter = (token: string, id: string, items: DraftItem[]) =>
  api<Encounter>(`/access/${token}/encounters/${id}/review`, { method: 'POST', body: { items } });

const RULES: { category: ClaimCategory; pattern: RegExp }[] = [
  { category: 'ALLERGIES', pattern: /\ballerg\w*\s+to\s+([a-z0-9 ,'-]{2,60})/gi },
  { category: 'CURRENT_MEDICATIONS', pattern: /\b(?:takes|taking|on)\s+([a-z0-9 ,'-]{2,60})/gi },
  { category: 'PAST_MEDICAL_HISTORY', pattern: /\b(?:history of|diagnosed with)\s+([a-z0-9 ,'-]{2,60})/gi },
];

/**
 * The one seam where AI plugs in. Today it is a simple rule-based stub; later it calls the on-device
 * model. Everything it returns is a DRAFT: a human must review it before it becomes part of a record.
 */
export async function structureEncounter(rawInput: string): Promise<DraftItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const items: DraftItem[] = [];
  for (const rule of RULES) {
    for (const match of rawInput.matchAll(rule.pattern)) {
      const value = (match[1] ?? '').trim().replace(/[.,;]+$/, '');
      if (value.length >= 2) items.push({ category: rule.category, value, excerpt: match[0].trim() });
    }
  }
  // Only summarise when something clinical was actually found. A note with nothing in it
  // should produce no items, not a sentence dressed up as a record entry.
  if (items.length === 0) return [];
  return items;
}
