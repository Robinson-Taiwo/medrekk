import { findTerms, type Term } from './medicalTerms';

/**
 * Reading the numbers on a laboratory report.
 *
 * The plain-language layer next door explains words. A lab report is not mostly words — it is a
 * column of measurements, each with a unit and an interval printed beside it, and the single
 * question a patient has is whether any of them fall outside. Nothing in the app answered that,
 * so a result sheet arrived as a wall of numbers with a glossary attached.
 *
 * THE RULE THIS FILE IS BUILT AROUND: MedRekk never supplies a reference interval. It compares a
 * value only against the interval printed on that same report, and when none is printed it says
 * so and stops.
 *
 * That is not caution for its own sake. Reference intervals are not universal facts — they vary
 * by laboratory, assay, age, sex, pregnancy and altitude, and a haemoglobin interval from a Lagos
 * lab does not apply in Jos, which is twelve hundred metres higher. A built-in table would quietly
 * convert every one of those differences into a false "below range" on somebody's phone, and a
 * false reassurance in the other direction. The report's own interval is the only one known to
 * apply to the sample that was actually taken.
 *
 * A flag here is also not a diagnosis, and this file must never produce one. Out of range is
 * common and often unimportant; in range does not rule anything out. What it reports is that a
 * number sits outside the interval the laboratory printed next to it — a fact about the page,
 * which is the only thing that can honestly be derived from the page alone.
 */

export type Standing =
  /** Outside the interval printed on this report. */
  | 'below'
  | 'above'
  /** Inside the interval printed on this report. */
  | 'within'
  /** A measurement with no interval beside it. Not an error — most reports are partly like this. */
  | 'no-range';

export interface LabFinding {
  /** The test as the report wrote it, e.g. "Hb" or "Haemoglobin". */
  label: string;
  /** The glossary entry, when the test is one MedRekk knows how to explain. */
  term?: Term;
  value: number;
  /** As printed. Absent when the report gave none, which is itself worth saying. */
  unit?: string;
  range?: { low: number; high: number };
  standing: Standing;
  /** Things about this line a person should check rather than trust. */
  concerns: string[];
  /** The line it came from, so every statement can be traced to the page. */
  source: string;
}

/** A result that is a word rather than a number: Positive, Negative, Not detected. */
export interface LabOutcome {
  label: string;
  term?: Term;
  outcome: 'positive' | 'negative' | 'inconclusive';
  source: string;
}

export interface LabReading {
  findings: LabFinding[];
  outcomes: LabOutcome[];
}

/* -------------------------------------------------------------- parsing */

/**
 * The interval beside a result. Reports write it every way imaginable:
 *   (12.0-16.0)   [12.0 – 16.0]   Ref: 12.0 to 16.0   12.0−16.0
 * Hyphen, en dash, em dash and minus are all used, and OCR swaps between them freely.
 */
const RANGE = /(?:ref(?:erence)?\s*(?:range|interval)?\s*[:=]?\s*)?[([]?\s*(\d+(?:\.\d+)?)\s*(?:[-–—−]|to)\s*(\d+(?:\.\d+)?)\s*[)\]]?/i;

/** The measured number and its unit. Units are messy: g/dL, x10^9/L, 10*9/L, mmol/l, %. */
const VALUE = /(\d+(?:\.\d+)?)\s*(%|[a-zA-Z](?:[a-zA-Z0-9/^*.·µ]|\s(?=\/))*)?/;

/** Words a lab uses instead of a number. */
const OUTCOME_WORDS: { re: RegExp; outcome: LabOutcome['outcome'] }[] = [
  { re: /\b(not\s+detected|negative|non[- ]?reactive|absent|nil\s+seen|no\s+growth)\b/i, outcome: 'negative' },
  { re: /\b(detected|positive|reactive|present|seen)\b/i, outcome: 'positive' },
  { re: /\b(equivocal|indeterminate|inconclusive|borderline|invalid)\b/i, outcome: 'inconclusive' },
];

/**
 * Labels that head a line of a report without being a measurement.
 *
 * "Collected 26/10/2026" otherwise parses perfectly: a word, then a number. It became
 * "Collected was measured at 26" with a complaint about the missing unit — confident, well
 * formed, and about a date.
 */
const NOT_A_TEST =
  /^(collected|received|reported|printed|date|time|sample|specimen|page|accession|lab\s*(no|number|id)|patient|name|age|sex|dob|requested\s*by|ward|phone|tel)\b/i;

/** dd/mm/yyyy, dd-mm-yy, 2026-10-26 — a date, whatever word precedes it. */
const DATE_SHAPED = /\b\d{1,4}\s*[/-]\s*\d{1,2}\s*[/-]\s*\d{2,4}\b/;

/** Separates the test name from everything after it. */
function splitLabel(line: string): { label: string; rest: string } | null {
  /*
   * A colon separates the name from the result — but only when the name in front of it holds no
   * number.
   *
   * "Haemoglobin 10.8 g/dL Ref: 12.0 to 16.0" has its colon inside "Ref:", so splitting there
   * made the label "Haemoglobin 10.8 g/dL Ref" and the result "12.0 to 16.0" — the interval
   * mistaken for the measurement, and then nothing parsed at all. A label carrying digits is the
   * sign the split landed in the wrong place, so the other strategies get the line instead.
   */
  const colon = /^([^:]{2,60}?)\s*[:=]\s*(.+)$/.exec(line);
  if (colon && !/\d/.test(colon[1])) return { label: colon[1].trim(), rest: colon[2].trim() };

  // "Haemoglobin ......... 10.8 g/dL" and "Haemoglobin   10.8 g/dL" — dot leaders or whitespace.
  const leader = /^([A-Za-z][A-Za-z0-9\s()\-+/]{1,59}?)\s*(?:\.{2,}|\s{2,}|\t)\s*(.+)$/.exec(line);
  if (leader) return { label: leader[1].trim(), rest: leader[2].trim() };

  // "Hb 10.8 g/dL (12.0-16.0)" — the name is whatever precedes the first number.
  const bare = /^([A-Za-z][A-Za-z0-9\s()\-+/]{1,59}?)\s+(?=\d)(.+)$/.exec(line);
  if (bare) return { label: bare[1].trim(), rest: bare[2].trim() };

  return null;
}

/**
 * A unit, or nothing. Rejects the fragments that look like units and are not: the "to" in
 * "12 to 16", a stray letter from OCR, the "H" or "L" a lab prints to mark its own flag.
 */
function cleanUnit(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const unit = raw.trim().replace(/[.,;]+$/, '');
  if (unit.length === 0) return undefined;
  if (/^(to|and|or|ref|range|normal|high|low|h|l|n)$/i.test(unit)) return undefined;
  return unit;
}

/**
 * One line of a report.
 *
 * Order matters: the interval is taken out of the line BEFORE the value is read, or
 * "10.8 g/dL (12.0-16.0)" yields 12.0 as the result — the first number after the range marker.
 */
function readLine(line: string): LabFinding | LabOutcome | null {
  const split = splitLabel(line);
  if (!split) return null;
  const { label, rest } = split;

  // A label made only of digits is a date or an identifier, not a test.
  if (!/[A-Za-z]{2}/.test(label)) return null;
  if (NOT_A_TEST.test(label)) return null;
  if (DATE_SHAPED.test(rest)) return null;

  const terms = findTerms(label);
  const term = terms.find((t) => t.kind === 'test') ?? terms[0];

  const word = OUTCOME_WORDS.find((o) => o.re.test(rest));
  if (word && !/\d/.test(rest.replace(/\b(19|20)\d{2}\b/g, ''))) {
    return { label, term, outcome: word.outcome, source: line };
  }

  const rangeMatch = RANGE.exec(rest);
  /*
   * Only treat it as a range when it announces itself — a bracket, the word "ref"/"range"/
   * "normal", or "to". Two bare numbers side by side are as likely to be a value and a count.
   *
   * The announcement is looked for in the matched text AND the dozen characters before it,
   * because RANGE's own "ref:" prefix group is optional and often is not part of the match. That
   * is why "Hb 10.8 g/dL Ref: 12.0 to 16.0" previously parsed as nothing at all.
   */
  const looksLikeRange =
    rangeMatch !== null &&
    /[([]|\bref|\brange|\binterval|\bnormal|\bto\b/i.test(
      rest.slice(Math.max(0, rangeMatch.index - 12), rangeMatch.index + rangeMatch[0].length),
    );

  const withoutRange = looksLikeRange ? rest.replace(rangeMatch[0], ' ') : rest;
  const valueMatch = VALUE.exec(withoutRange);
  if (!valueMatch) return null;

  const value = Number(valueMatch[1]);
  if (!Number.isFinite(value)) return null;

  const unit = cleanUnit(valueMatch[2]);
  const range = looksLikeRange
    ? { low: Number(rangeMatch[1]), high: Number(rangeMatch[2]) }
    : undefined;

  const concerns: string[] = [];
  let standing: Standing = 'no-range';

  if (range) {
    if (range.low >= range.high) {
      // A reversed or equal interval cannot be compared against. Saying so beats guessing which
      // number was meant to be which.
      concerns.push('The reference range on this report reads oddly, so MedRekk has not compared against it.');
    } else {
      standing = value < range.low ? 'below' : value > range.high ? 'above' : 'within';
    }
  } else {
    concerns.push('This report did not print a reference range for this result, so MedRekk cannot say whether it is expected.');
  }

  if (!unit) {
    concerns.push('No unit was printed for this result. The same number means different things in different units.');
  }

  return { label, term, value, unit, range, standing, concerns, source: line };
}

/* ----------------------------------------------------------- composition */

function segments(note: string): string[] {
  return note
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*\s]+/, '').trim())
    .filter((s) => s.length > 2);
}

/** Every measurement and every worded result MedRekk can read off a report. */
export function readLabReport(note: string): LabReading {
  const findings: LabFinding[] = [];
  const outcomes: LabOutcome[] = [];

  for (const line of segments(note)) {
    const read = readLine(line);
    if (!read) continue;
    if ('outcome' in read) outcomes.push(read);
    else findings.push(read);
  }

  return { findings, outcomes };
}

/* ------------------------------------------------------------ sentences */

/** How the result reads, in words, with the interval it was compared against. */
export function standingSentence(f: LabFinding): string {
  const shown = `${f.value}${f.unit ? ` ${f.unit}` : ''}`;
  // Keyed on standing, not on whether a range was found. A range that could not be used — one
  // printed backwards — left this saying "inside the 16–12 range", reporting a comparison it
  // had explicitly declined to make.
  if (f.standing === 'no-range') return `${f.label} was measured at ${shown}.`;
  const interval = `${f.range!.low}–${f.range!.high}${f.unit ? ` ${f.unit}` : ''}`;
  const verb = /s$/i.test(f.label) ? 'are' : 'is';
  if (f.standing === 'below') return `${f.label} ${verb} ${shown}, below the ${interval} range this laboratory printed.`;
  if (f.standing === 'above') return `${f.label} ${verb} ${shown}, above the ${interval} range this laboratory printed.`;
  return `${f.label} ${verb} ${shown}, inside the ${interval} range this laboratory printed.`;
}

/**
 * What a result outside the interval may be associated with — only where the glossary has a
 * reviewed answer for that direction, and always as an association rather than a finding.
 *
 * Nothing is generated for a result inside the range: "this is normal" is a claim about a person,
 * and the only thing known here is a number against an interval.
 */
export function meaningSentence(f: LabFinding): string | null {
  if (!f.term) return null;
  const associated = f.standing === 'below' ? f.term.lowMeans : f.standing === 'above' ? f.term.highMeans : undefined;
  if (!associated) return null;
  return `A ${f.standing === 'below' ? 'low' : 'high'} ${f.term.name.toLowerCase()} can be associated with ${associated}, but one result cannot establish that on its own — it is read alongside other results, symptoms and an examination.`;
}

/**
 * The category of attention, never the action.
 *
 * Deliberately the same sentence for every out-of-range result, because distinguishing "routine"
 * from "urgent" is a clinical judgement that depends on how far out, which test, and who the
 * patient is — and getting that wrong in either direction is the worst thing this feature could
 * do. Telling somebody their result is reassuring is as harmful as frightening them.
 */
export function nextStepSentence(reading: LabReading): string | null {
  const flagged = reading.findings.filter((f) => f.standing === 'below' || f.standing === 'above');
  const positives = reading.outcomes.filter((o) => o.outcome === 'positive' || o.outcome === 'inconclusive');
  if (flagged.length === 0 && positives.length === 0) return null;

  // Counted separately, because they are different things. A positive malaria test is not
  // "outside a range" — there is no range — and folding both into one number produced a sentence
  // that was wrong about half of what it was counting.
  const parts: string[] = [];
  if (flagged.length > 0) {
    parts.push(
      flagged.length === 1
        ? 'one result falls outside the range this laboratory printed'
        : `${flagged.length} results fall outside the ranges this laboratory printed`,
    );
  }
  if (positives.length > 0) {
    parts.push(
      positives.length === 1
        ? 'one test came back positive or unclear'
        : `${positives.length} tests came back positive or unclear`,
    );
  }

  return `On this report ${parts.join(', and ')}. Take it to a qualified health worker, who can judge what it means alongside everything else they know about you. MedRekk cannot tell you whether this is serious, and nothing here is a reason to start, stop or change any medicine.`;
}
