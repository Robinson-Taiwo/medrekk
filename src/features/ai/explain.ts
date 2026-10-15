import { CATEGORY_LABELS, type ClaimCategory } from '@/features/worker/workerApi';
import { findTerms, type Term } from './medicalTerms';
import { refreshModelStatus, useModelStatusSnapshot } from './modelStore';

export interface Explanation {
  text: string;
  fromModel: boolean;
  /** True when the words came from the reviewed glossary rather than the model or a template. */
  fromGlossary?: boolean;
}

const SCOPE_WORDS: Record<string, string> = {
  ALLERGIES: 'what you are allergic to',
  CURRENT_MEDICATIONS: 'the medicines you take',
  RECENT_ENCOUNTERS: 'your recent visits',
  PAST_MEDICAL_HISTORY: 'your past conditions',
  LAB_RESULTS: 'your test results',
  REFERRALS: 'your referrals',
  EMERGENCY_INFORMATION: 'your emergency information',
};

/** Never let a plain-language line turn into advice or a dose. If it does, we show the plain version. */
const UNSAFE = /\b(you should|you must|take |stop taking|see a doctor|recommend|advise|diagnos|treat)\b|\d+\s?(mg|ml|mcg|tablets?)\b/i;

function plainScopes(scopes: string[]): string {
  const words = scopes.map((s) => SCOPE_WORDS[s] ?? CATEGORY_LABELS[s as ClaimCategory]?.toLowerCase() ?? s);
  if (words.length === 1) return words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${last}`;
}

function plainDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'one hour' : `${hours} hours`;
}

/** The dependable version, used as the fallback and whenever the model is absent or unsafe. */

const STATUS_WORDS: Record<string, string> = {
  UNVERIFIED: 'Nobody has confirmed this yet.',
  SELF_REPORTED: 'You added this yourself.',
  EVIDENCE_BACKED: 'A health worker saw evidence for this.',
  CLINICALLY_VERIFIED: 'A clinician confirmed this.',
};

const CATEGORY_WORDS: Record<string, string> = {
  ALLERGIES: 'something you are allergic to',
  CURRENT_MEDICATIONS: 'a medicine you take',
  RECENT_ENCOUNTERS: 'a recent visit',
  PAST_MEDICAL_HISTORY: 'part of your medical history',
  LAB_RESULTS: 'a test result',
};

export interface ClaimForExplaining {
  category: string;
  value: string;
  status: string;
  source: string;
}

/** The dependable version. Used immediately, and whenever the model is absent or its answer is unsafe. */
export function plainClaim(claim: ClaimForExplaining): string {
  const what = CATEGORY_WORDS[claim.category] ?? 'something on your record';
  // The source is deliberately left out: it is shown separately, and including it here has made the
  // model mistake the person who recorded the item for the patient it is about.
  return `Your record says "${claim.value}" is ${what}. ${STATUS_WORDS[claim.status] ?? ''}`.trim();
}

/**
 * Restates what the record says in everyday words. It never explains what a medicine does or what a
 * condition means: that is medical knowledge, and a small on-device model is not a safe source for it.
 */
/** Composes the glossary entries into something that reads as a short explanation, not a list. */
function fromGlossary(terms: Term[], claim: ClaimForExplaining): string {
  const sentences = terms.map((term) => {
    const lead = term.name.toLowerCase() === term.name ? term.name : term.name;
    return `${lead}: ${term.plain}`;
  });

  const context =
    claim.category === 'ALLERGIES'
      ? 'Your record says this is something you are allergic to.'
      : claim.category === 'CURRENT_MEDICATIONS'
        ? 'Your record lists this among the medicines you take.'
        : claim.category === 'LAB_RESULTS'
          ? 'Your record holds this as a test result.'
          : claim.category === 'PAST_MEDICAL_HISTORY'
            ? 'Your record holds this as part of your medical history.'
            : 'Your record holds this from a recent visit.';

  return `${sentences.join(' ')} ${context} ${STATUS_WORDS[claim.status] ?? ''}`.trim();
}


export interface ExplanationSections {
  /** A factual restatement of what is on the record. Always present. */
  recorded: string;
  /** What the terms mean, from the reviewed glossary. Absent when nothing was recognised. */
  meaning?: string;
  /** Any documented next step. Absent when the record does not contain one. */
  next?: string;
  /** Set when part of the entry could not be interpreted confidently. */
  unclear?: string;
  source: 'glossary' | 'model' | 'template';
}

const RECORDED_LEAD: Record<string, string> = {
  ALLERGIES: 'Your record lists this as something you are allergic to',
  CURRENT_MEDICATIONS: 'Your record lists this among the medicines you take',
  RECENT_ENCOUNTERS: 'Your record holds this from a recent visit',
  PAST_MEDICAL_HISTORY: 'Your record holds this as part of your medical history',
  LAB_RESULTS: 'Your record holds this as a test result',
};

/**
 * Builds the explanation from reviewed content only. When nothing in the entry is recognised,
 * it says so rather than guessing: a fluent wrong explanation is worse than an honest gap.
 */
export function explainSections(claim: ClaimForExplaining): ExplanationSections {
  const terms = findTerms(claim.value);
  const lead = RECORDED_LEAD[claim.category] ?? 'Your record holds this';

  const recorded = `${lead}: "${claim.value}". ${STATUS_WORDS[claim.status] ?? ''}`.trim();

  if (terms.length === 0) {
    return {
      recorded,
      unclear:
        'None of the medical terms in this entry could be matched to the reviewed glossary, so it has not been explained. Ask the health worker who recorded it what it means.',
      source: 'template',
    };
  }

  const meaning = terms.map((term) => `${term.name}: ${term.plain}`).join(' ');

  const named = terms.map((t) => t.name.toLowerCase());
  const unrecognised = claim.value
    .split(/[,;]| and /i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !named.some((n) => part.toLowerCase().includes(n)));

  return {
    recorded,
    meaning,
    unclear:
      unrecognised.length > 0
        ? `Part of this entry was not recognised: "${unrecognised[0]}". Ask the health worker who recorded it.`
        : undefined,
    source: 'glossary',
  };
}

export async function explainClaim(claim: ClaimForExplaining): Promise<Explanation> {
  const plain = plainClaim(claim);

  // A reviewed glossary beats a small model on medical facts, so it goes first.
  const terms = findTerms(claim.value);
  if (terms.length > 0) {
    return { text: fromGlossary(terms, claim), fromModel: false, fromGlossary: true };
  }
  await refreshModelStatus(true);
  if (useModelStatusSnapshot().state !== 'READY') return { text: plain, fromModel: false };

  try {
    const { completeText } = await import('./llama');
    const text = await completeText(
      [
        'Rewrite the following in one or two short sentences, speaking directly to the patient as "you".',
        'Say only what is already written. Keep the exact names of any medicines or substances.',
        'An allergy means a substance causes a reaction, not that the patient has a reaction right now.',
        'Never explain what a medicine does, what a condition means, or whether something is serious.',
        'Never give advice and never mention a dose that is not written here.',
      ].join(' '),
      plain,
      110,
    );
    const trimmed = text.trim();
    if (trimmed.length < 15 || trimmed.length > 400 || UNSAFE.test(trimmed)) {
      return { text: plain, fromModel: false };
    }
    return { text: trimmed, fromModel: true };
  } catch {
    return { text: plain, fromModel: false };
  }
}

export function plainAccessRequest(input: {
  name: string;
  role: string;
  reason: string;
  scopes: string[];
  minutes: number;
}): string {
  const role = input.role.toLowerCase().replace(/_/g, ' ');
  return `${input.name}, a ${role}, wants to see ${plainScopes(input.scopes)} for the next ${plainDuration(
    input.minutes,
  )}. They say it is for: ${input.reason}.`;
}

export async function explainAccessRequest(input: {
  name: string;
  role: string;
  reason: string;
  scopes: string[];
  minutes: number;
}): Promise<Explanation> {
  const plain = plainAccessRequest(input);
  await refreshModelStatus(true);
  if (useModelStatusSnapshot().state !== 'READY') return { text: plain, fromModel: false };

  try {
    const { completeText } = await import('./llama');
    const text = await completeText(
      [
        'Rewrite the following in one short, warm sentence a patient can understand.',
        'Say who is asking, what they want to see, and for how long. Do not add anything else.',
        'Never give medical advice and never mention any medicine or dose.',
      ].join(' '),
      plain,
      90,
    );
    const trimmed = text.trim();
    if (trimmed.length < 15 || trimmed.length > 320 || UNSAFE.test(trimmed)) {
      return { text: plain, fromModel: false };
    }
    return { text: trimmed, fromModel: true };
  } catch {
    return { text: plain, fromModel: false };
  }
}
