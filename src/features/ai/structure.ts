import { structureEncounter as stubStructure, type DraftItem } from '@/features/worker/workerApi';
import { refreshModelStatus, useModelStatusSnapshot } from './modelStore';

export type DraftSource = 'MODEL' | 'STUB';

export interface StructureResult {
  items: DraftItem[];
  source: DraftSource;
  millis: number;
  note: string | null;
}

/**
 * The single AI seam. When the model runs successfully, its answer stands even if it is empty:
 * "nothing to record" is a valid and often correct answer, and falling back to regex would
 * invent items the note never contained.
 */
/** Longest a claim value may be. Beyond this it is prose, not a thing to put on a record. */
const MAX_CLAIM_WORDS = 8;

/**
 * "No known allergies" is a statement that something is absent. Recorded as an allergy it reads as
 * its own opposite, so anything negated is dropped rather than stored the wrong way round.
 */
const NEGATED = /^(no|not|nil|none|negative|denies|without|absent)\b/i;

/** A bare interval such as "12.0-16.0 g/dL" is a reference range, not a result. */
const BARE_RANGE = /^\d+(?:\.\d+)?\s*[-–—]\s*\d+(?:\.\d+)?\s*[a-z/%]*$/i;

/**
 * A drug class is not a medicine. Recording "antihypertensive medicine" as a medication looks like
 * a prescription while naming nothing that was actually taken.
 */
const DRUG_CLASS = /^(anti[a-z]+|[a-z]+ (medicine|medication|drugs?|tablets?))$/i;

/**
 * The full note already lives on the encounter and is shown to the patient as the original capture.
 * Copying it into a claim produced paragraph-sized entries nothing could explain, so anything that
 * looks like a restatement of the note rather than a single fact is dropped here, whichever path
 * produced it.
 */
function keepAsClaim(item: DraftItem): boolean {
  if (item.category === 'RECENT_ENCOUNTERS') return false;

  const value = item.value.trim();
  if (NEGATED.test(value)) return false;
  if (BARE_RANGE.test(value)) return false;
  if (item.category === 'CURRENT_MEDICATIONS' && DRUG_CLASS.test(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_CLAIM_WORDS;
}

export async function structure(rawInput: string): Promise<StructureResult> {
  const started = Date.now();
  await refreshModelStatus(true);
  const ready = useModelStatusSnapshot().state === 'READY';

  if (!ready) {
    const items = (await stubStructure(rawInput)).filter(keepAsClaim);
    return {
      items,
      source: 'STUB',
      millis: Date.now() - started,
      note: 'No on-device model installed. Open the Model tab to add it.',
    };
  }

  try {
    const { structureWithModel } = await import('./llama');
    const items = (await structureWithModel(rawInput)).filter(keepAsClaim);
    return {
      items,
      source: 'MODEL',
      millis: Date.now() - started,
      note: items.length === 0 ? 'Nothing to record was found in this note.' : null,
    };
  } catch (e) {
    const fallback = (await stubStructure(rawInput)).filter(keepAsClaim);
    return {
      items: fallback,
      source: 'STUB',
      millis: Date.now() - started,
      note: e instanceof Error ? `Model failed: ${e.message}` : 'The on-device model failed.',
    };
  }
}
