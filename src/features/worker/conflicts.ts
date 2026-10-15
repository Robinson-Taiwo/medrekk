import type { DraftItem } from './workerApi';

export interface Conflict {
  allergy: string;
  medicine: string;
}

/**
 * Flags a medicine that matches something recorded as an allergy. It states the contradiction only:
 * what to do about it is a clinical decision, not ours.
 */
const FAMILIES: { name: string; members: string[] }[] = [
  { name: 'penicillin', members: ['penicillin', 'amoxicillin', 'ampicillin', 'flucloxacillin', 'augmentin', 'co-amoxiclav'] },
  { name: 'sulfonamide', members: ['sulfa', 'sulfamethoxazole', 'co-trimoxazole', 'septrin', 'bactrim'] },
  { name: 'NSAID', members: ['aspirin', 'ibuprofen', 'diclofenac', 'naproxen'] },
];

const normalise = (text: string): string => text.toLowerCase();

function familyOf(text: string): string | null {
  const flat = normalise(text);
  for (const family of FAMILIES) {
    if (family.members.some((member) => flat.includes(member))) return family.name;
  }
  return null;
}

export function findConflicts(items: DraftItem[]): Conflict[] {
  const allergies = items.filter((i) => i.category === 'ALLERGIES');
  const medicines = items.filter((i) => i.category === 'CURRENT_MEDICATIONS');
  const out: Conflict[] = [];

  for (const allergy of allergies) {
    const family = familyOf(allergy.value);
    if (!family) continue;
    for (const medicine of medicines) {
      if (familyOf(medicine.value) === family) {
        out.push({ allergy: allergy.value, medicine: medicine.value });
      }
    }
  }
  return out;
}
