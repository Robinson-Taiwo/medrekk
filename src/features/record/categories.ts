import type Feather from '@expo/vector-icons/Feather';

/**
 * How a record category is named and drawn, in one place. The home screen and the record
 * screen both summarise the same claims, and when each kept its own copy they drifted.
 */

export const CATEGORY_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  ALLERGIES: 'alert-triangle',
  CURRENT_MEDICATIONS: 'thermometer',
  RECENT_ENCOUNTERS: 'activity',
  PAST_MEDICAL_HISTORY: 'book-open',
  LAB_RESULTS: 'droplet',
};

export const CATEGORY_NOUN: Record<string, [singular: string, plural: string]> = {
  ALLERGIES: ['allergy', 'allergies'],
  CURRENT_MEDICATIONS: ['medicine', 'medicines'],
  PAST_MEDICAL_HISTORY: ['history item', 'history items'],
  LAB_RESULTS: ['test result', 'test results'],
  RECENT_ENCOUNTERS: ['visit', 'visits'],
};

export function nounFor(category: string, count: number): string {
  const nouns = CATEGORY_NOUN[category];
  if (!nouns) return count === 1 ? 'item' : 'items';
  return count === 1 ? nouns[0] : nouns[1];
}

export function countByCategory(claims: readonly { category: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const claim of claims) counts.set(claim.category, (counts.get(claim.category) ?? 0) + 1);
  return counts;
}

/**
 * Says what shape a set of claims is without naming anything clinical — "2 medicines, 1
 * allergy". The timeline and the home screen are the two most glanceable screens in the app,
 * so this tells the patient what they need without showing a passer-by what they are being
 * treated for.
 */
export function summarise(claims: readonly { category: string }[]): string {
  return [...countByCategory(claims).entries()]
    .map(([category, n]) => `${n} ${nounFor(category, n)}`)
    .join(', ');
}
