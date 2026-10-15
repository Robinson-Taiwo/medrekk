import { findTerms, TERMS, type Term } from './medicalTerms';

export interface Section {
  /** A question, as the patient would ask it. */
  heading: string;
  body: string;
  /** Marks a section that says what could not be worked out, rather than what was found. */
  uncertain?: boolean;
}

export interface ReportExplanation {
  sections: Section[];
  /** Which template recognised the note, for the footer line. */
  kind: 'LAB_RESULT' | 'RAPID_TEST' | 'VITAL_SIGN' | 'PRESCRIPTION' | 'GENERAL';
}

const NUMBER = String.raw`\d+(?:\.\d+)?`;

/**
 * Templates 44 to 46 of the reviewed library: what to say when the record cannot be interpreted
 * safely. These matter more than any single clinical template, because anything the engine does
 * not recognise lands here, and saying nothing confidently is always safe.
 */
export const UNINTERPRETABLE = {
  noInterval: (value: string, unit: string) =>
    `The recorded result is ${value}${unit ? ` ${unit}` : ''}. No reference interval was written on this report, so it cannot be classified here as low, within range or high. Reference intervals differ between laboratories, so ask the health worker for the one that applies.`,

  incomplete: (test: string) =>
    `This report contains a result for ${test}, but the information needed to interpret it is incomplete. The unit and measurement details should be confirmed before any interpretation is relied on.`,

  conflicting: (field: string) =>
    `The record contains conflicting information about ${field}. The difference should be checked against the original report before any interpretation is relied on.`,

  unclear: (field: string) =>
    `Part of this report could not be read confidently as ${field}. It should be checked against the original before being used.`,

  documentedDiagnosis: (diagnosis: string, by: string, when: string) =>
    `This record documents a diagnosis of ${diagnosis}, recorded by ${by} on ${when}. This page is reporting what was written; it does not independently establish the diagnosis.`,
};

/** A value with no recognised test name or no unit cannot be compared, so it is never classified. */
function isInterpretable(read: { unit: string; value: number }): boolean {
  return read.unit.trim().length > 0 && Number.isFinite(read.value);
}


/** Pulls a measured value, its unit and any reference interval out of a laboratory note. */
function readLabResult(note: string): {
  /** Absent when the test is not in the glossary: the comparison still works, the clinical note does not. */
  term?: Term;
  unknownTest?: string;
  value: number;
  unit: string;
  low?: number;
  high?: number;
  lowText?: string;
  highText?: string;
  flagged?: string;
} | null {
  // A test name, then a value and unit: "Hb: 9.2 g/dL", "Haemoglobin 9.2 g/dL".
  const measure = new RegExp(String.raw`([A-Za-z][A-Za-z0-9 ]{0,30}?)\s*[:\-]?\s*(${NUMBER})\s*(g/dL|mg/dL|mmol/L|%|g/L)`, 'i');
  const found = note.match(measure);
  if (!found) return null;

  const [, rawName, rawValue, unit] = found;
  const terms = findTerms(rawName ?? '');
  const term = terms.find((t) => t.kind === 'test');
  // An unrecognised test still has a value, a unit and possibly an interval, and comparing two
  // numbers is arithmetic. Only the clinical sentence needs the glossary, so it is left out.
  const unknownTest = term ? undefined : (rawName ?? '').trim();

  // "Lab reference interval: 12.0-16.0 g/dL", with any dash.
  const interval = new RegExp(String.raw`(${NUMBER})\s*[-–—to]+\s*(${NUMBER})\s*(?:g/dL|mg/dL|mmol/L|%|g/L)?`, 'i');
  const range = note.replace(found[0], '').match(interval);

  const flagged = /flagged\s+(low|high)|marked\s+(low|high)|\b(low|high)\b/i.exec(note);

  return {
    term,
    unknownTest,
    value: Number(rawValue),
    unit: unit ?? '',
    low: range ? Number(range[1]) : undefined,
    high: range ? Number(range[2]) : undefined,
    // Kept as written, so "12.0" is not shown back to the patient as "12".
    lowText: range?.[1],
    highText: range?.[2],
    flagged: flagged ? (flagged[1] ?? flagged[2] ?? flagged[3])?.toLowerCase() : undefined,
  };
}

/**
 * Builds the laboratory explanation. Every sentence restates something written on the report or
 * compares two numbers that are both on it. Nothing here concludes why a result is what it is.
 */
function labSections(note: string, read: NonNullable<ReturnType<typeof readLabResult>>): Section[] {
  const { term, unknownTest, value, unit, low, high, lowText, highText, flagged } = read;
  const name = term ? (term.fullName ?? term.name.toLowerCase()) : (unknownTest || 'this test');
  const sections: Section[] = [];

  const hasInterval = low !== undefined && high !== undefined;
  const recorded = [
    `Your ${name} level was recorded as ${value} ${unit}.`,
    hasInterval ? ` The reference interval written on this report is ${lowText ?? low}–${highText ?? high} ${unit}` : '',
    hasInterval && flagged ? `, and the laboratory marked your result as ${flagged}.` : hasInterval ? '.' : '',
  ].join('');

  sections.push({ heading: 'What was recorded?', body: recorded });
  if (term) sections.push({ heading: `What is ${name}?`, body: term.plain });

  if (hasInterval) {
    const where = value < low ? 'below' : value > high ? 'above' : 'within';
    const caution =
      where === 'below' && term?.lowMeans
        ? ` A low ${name} result can be associated with ${term.lowMeans}, but the result alone does not establish the cause or determine the full clinical picture.`
        : where === 'above' && term?.highMeans
          ? ` A high ${name} result can be associated with ${term.highMeans}, but the result alone does not establish the cause or determine the full clinical picture.`
          : where === 'within'
            ? ' A result inside the interval is not on its own a full picture of your health.'
            : ' The result alone does not establish the cause or determine the full clinical picture.';

    sections.push({
      heading: 'What does the result mean?',
      body: `The recorded result is ${where} the reference interval supplied by this laboratory.${caution}`,
    });
  } else {
    sections.push({
      heading: 'What does the result mean?',
      body: isInterpretable({ unit, value })
        ? UNINTERPRETABLE.noInterval(String(value), unit)
        : UNINTERPRETABLE.incomplete(name),
      uncertain: true,
    });
  }

  return sections;
}


/**
 * Template 28 of the reviewed library. A rapid test reports whether its own target was detected,
 * which is not the same as whether the person has the illness, so the wording stays with the test.
 */
function readRapidTest(note: string): { target: string; result: 'positive' | 'negative' | 'invalid' } | null {
  const found = note.match(
    /([A-Za-z][A-Za-z ]{0,20}?)\s*(?:rapid (?:diagnostic )?test|rdt)\s*(?:was|is|reported|result)?\s*[:\-]?\s*(positive|negative|invalid|\+ve|-ve)/i,
  );
  if (!found) return null;

  const raw = (found[2] ?? '').toLowerCase();
  const result = raw.startsWith('pos') || raw === '+ve' ? 'positive' : raw.startsWith('neg') || raw === '-ve' ? 'negative' : 'invalid';

  return { target: (found[1] ?? '').trim() || 'the target', result };
}

function rapidTestSections(read: NonNullable<ReturnType<typeof readRapidTest>>): Section[] {
  const { target, result } = read;
  const name = target.toLowerCase();

  const body =
    result === 'positive'
      ? `The ${name} rapid test was reported as positive, meaning the test detected what it looks for. This supports the presence of ${name}, but it is read alongside your symptoms and the health worker's assessment rather than on its own.`
      : result === 'negative'
        ? `The ${name} rapid test was reported as negative, meaning the test did not detect what it looks for. A negative result does not rule ${name} out in every case, so further assessment may be needed if symptoms continue.`
        : `The ${name} rapid test was reported as invalid, so it cannot be read as positive or negative. The test should be repeated.`;

  return [
    { heading: 'What was recorded?', body: `A ${name} rapid test was done, and the result was recorded as ${result}.` },
    { heading: 'What does the result mean?', body, uncertain: result === 'invalid' },
  ];
}

/**
 * Template 32. A single reading is a single reading: it is compared against commonly used adult
 * thresholds and nothing more, since the thresholds differ for children and in pregnancy.
 */
function readBloodPressure(note: string): { systolic: number; diastolic: number } | null {
  const found = note.match(/\b(?:bp\s*[:\-]?\s*)?(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mmhg)?/i);
  if (!found) return null;

  const systolic = Number(found[1]);
  const diastolic = Number(found[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  if (systolic < 50 || systolic > 300 || diastolic < 30 || diastolic > 200) return null;

  return { systolic, diastolic };
}

function bloodPressureSections(read: NonNullable<ReturnType<typeof readBloodPressure>>): Section[] {
  const { systolic, diastolic } = read;
  // Commonly used adult thresholds only. Age, pregnancy and clinical context are not available here,
  // so the wording describes the reading's position and never names a condition.
  const raised = systolic >= 140 || diastolic >= 90;
  const low = systolic < 90 || diastolic < 60;

  const position = raised
    ? 'This reading is higher than the thresholds usually used for adults.'
    : low
      ? 'This reading is lower than the thresholds usually used for adults.'
      : 'This reading is within the range usually used for adults.';

  return [
    {
      heading: 'What was recorded?',
      body: `Your blood pressure was recorded as ${systolic}/${diastolic} mmHg.`,
    },
    {
      heading: 'What is blood pressure?',
      body: 'Blood pressure measures the force of blood against the walls of your arteries. The first number is the pressure when the heart beats, and the second is the pressure when it relaxes between beats.',
    },
    {
      heading: 'What does the reading mean?',
      body: `${position} A single reading does not on its own establish a diagnosis, and it does not explain why the reading is what it is. That depends on repeat measurements, how the reading was taken, and the rest of your clinical picture.`,
    },
  ];
}


/** How a frequency is written in a note, and what it says in words. Nothing is inferred. */
const FREQUENCY: { pattern: RegExp; words: string }[] = [
  { pattern: /\bq(?:uaque )?4\s*h\b/i, words: 'every four hours' },
  { pattern: /\bq(?:uaque )?6\s*h\b/i, words: 'every six hours' },
  { pattern: /\bq(?:uaque )?8\s*h\b/i, words: 'every eight hours' },
  { pattern: /\bq(?:uaque )?12\s*h\b/i, words: 'every twelve hours' },
  { pattern: /\bbd\b|\bbid\b|\btwice daily\b/i, words: 'twice a day' },
  { pattern: /\btds\b|\btid\b|\bthree times daily\b/i, words: 'three times a day' },
  { pattern: /\bqds\b|\bqid\b|\bfour times daily\b/i, words: 'four times a day' },
  { pattern: /\bonce daily\b|\bdaily\b/i, words: 'once a day' },
  { pattern: /\bnocte\b|\bat night\b/i, words: 'at night' },
  { pattern: /\bstat\b/i, words: 'straight away, as a single dose' },
];

const ROUTE: { pattern: RegExp; words: string }[] = [
  { pattern: /\bpo\b|\bby mouth\b|\borally\b/i, words: 'by mouth' },
  { pattern: /\biv\b|\bintravenous\b/i, words: 'into a vein' },
  { pattern: /\bim\b|\bintramuscular\b/i, words: 'by injection into a muscle' },
];

/**
 * Template 43. Every part of this is read from the note and restated; nothing is filled in. A
 * missing frequency stays missing, because inventing one would be inventing a prescription.
 */
function readPrescription(note: string): {
  drug: Term;
  strength?: string;
  route?: string;
  frequency?: string;
  asNeeded?: string;
  duration?: string;
} | null {
  const drug = findTerms(note).find((t) => t.kind === 'drug');
  if (!drug) return null;

  const strength = note.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?))\b/i)?.[1];
  const route = ROUTE.find((r) => r.pattern.test(note))?.words;
  const frequency = FREQUENCY.find((f) => f.pattern.test(note))?.words;
  const asNeeded = /\bprn\b|\bas needed\b|\bwhen (?:required|needed)\b/i.test(note)
    ? note.match(/\bprn\s+([a-z ]{2,20})/i)?.[1]?.trim()
    : undefined;
  const duration = note.match(/(?:x|for)\s*(\d+)\s*(day|week|month)s?\b/i)?.slice(1, 3).join(' ');

  if (!strength && !route && !frequency && !duration) return null;
  return { drug, strength, route, frequency, asNeeded, duration };
}

function prescriptionSections(read: NonNullable<ReturnType<typeof readPrescription>>): Section[] {
  const { drug, strength, route, frequency, asNeeded, duration } = read;

  const parts = [
    strength ? `${strength}` : null,
    route ? `taken ${route}` : null,
    frequency,
    asNeeded ? `when needed for ${asNeeded}` : /\bprn\b/i.test(JSON.stringify(read)) ? 'when needed' : null,
    duration ? `for ${duration}${duration.endsWith('s') ? '' : 's'}` : null,
  ].filter(Boolean);

  const instructions =
    parts.length > 0
      ? `${drug.name} ${parts.join(', ')}.`
      : `${drug.name}, with no further instructions written in this note.`;

  const missing = [!strength ? 'strength' : null, !frequency ? 'how often to take it' : null].filter(Boolean);

  const sections: Section[] = [
    { heading: 'What was recorded?', body: `This note records ${instructions}` },
    { heading: `What is ${drug.name.toLowerCase()}?`, body: drug.plain },
    {
      heading: 'What does this mean?',
      body: 'This restates the instructions as they were written. It does not confirm that the medicine was taken, and it is not a check that the prescription is right for you. Follow the instructions on the medicine itself, and ask the health worker or pharmacist if anything differs.',
    },
  ];

  if (missing.length > 0) {
    sections.push({
      heading: 'What is not clear?',
      body: `The ${missing.join(' and ')} was not written in this note. Check the medicine packet or ask the health worker before taking it.`,
      uncertain: true,
    });
  }

  return sections;
}

/** Anything the templates do not recognise: the note as written, plus whatever terms are known. */
function generalSections(note: string): Section[] {
  const terms = findTerms(note);
  const sections: Section[] = [{ heading: 'What was recorded?', body: note }];

  if (terms.length > 0) {
    sections.push({
      heading: 'What do the terms mean?',
      body: terms.map((t) => `${t.name}: ${t.plain}`).join('\n\n'),
    });
  } else {
    sections.push({
      heading: 'What does this mean?',
      body: 'None of the terms in this note could be matched to the reviewed glossary, so it has not been explained here. Ask the health worker who recorded it.',
      uncertain: true,
    });
  }

  return sections;
}

/** Any documented next step, in the worker's own words. */
export function planSections(note: string): Section | null {
  const sentences = note.split(/(?<=[.!?])\s+/).map((s) => s.trim());
  const patterns = [
    /^review\b/i,
    /^repeat\b/i,
    /^referred?\b/i,
    /^follow[- ]?up\b/i,
    /^return\b/i,
    /^continue\b/i,
    /^clinician review\b/i,
    /\breview (if|in|after)\b/i,
    /\bfurther assessment\b/i,
    /\brefer(red)? to\b/i,
  ];
  const found = sentences.filter((s) => s.length > 3 && patterns.some((p) => p.test(s)));

  if (found.length === 0) {
    return {
      heading: 'What happens next?',
      body: 'No follow-up plan was written in this note. Ask the health worker what should happen next.',
      uncertain: true,
    };
  }
  return { heading: 'What happens next?', body: found.join(' ') };
}

/** Picks the template that fits the note and builds the explanation from reviewed content only. */
export function explainReport(note: string): ReportExplanation {
  // Most specific template first. Each one only claims the note when its own pattern is present.
  const lab = readLabResult(note);
  const rapid = readRapidTest(note);
  const bp = readBloodPressure(note);
  const script = readPrescription(note);

  const sections = lab
    ? labSections(note, lab)
    : rapid
      ? rapidTestSections(rapid)
      : bp
        ? bloodPressureSections(bp)
        : script
          ? prescriptionSections(script)
          : generalSections(note);
  const plan = planSections(note);
  if (plan) sections.push(plan);
  return { sections, kind: lab ? 'LAB_RESULT' : rapid ? 'RAPID_TEST' : bp ? 'VITAL_SIGN' : script ? 'PRESCRIPTION' : 'GENERAL' };
}

/** Exposed so a screen can tell whether anything in the glossary is relevant at all. */
export const GLOSSARY_SIZE = TERMS.length;
