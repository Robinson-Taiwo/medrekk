import { findTerms, type Term } from './medicalTerms';

/**
 * A clinical note, said the way a person would say it.
 *
 * The glossary next door explains what a word means. That is not the same as understanding your
 * own prescription: being told "ciprofloxacin is an antibiotic" does not tell you that the line
 * "Tab Ciprotab 500mg BD x 5/7" means one 500mg tablet, twice a day, for five days. Every part of
 * that line is a convention nobody outside the profession is taught, and Ciprotab is not even in
 * the dictionary — it is the brand the pharmacy happened to hand over.
 *
 * So this reads the line as a line, not as a bag of words, and writes one sentence per thing
 * found.
 *
 * Three rules it never breaks:
 *   - Nothing is invented. An unrecognised drug keeps its name and gets its dosing explained;
 *     what it is for is simply left unsaid rather than guessed.
 *   - No advice. It says what the note records, never whether it is right, safe or serious, and
 *     never what to do about it.
 *   - No model. This is regex and a reviewed glossary, so it reads the same on a phone with no
 *     signal, no downloaded model and no battery to spare — which is most of the phones.
 */

export interface PlainLine {
  /** The sentence to show. Already complete and punctuated. */
  text: string;
  /** What this line is about, for the icon beside it. */
  kind: 'medicine' | 'test' | 'condition' | 'instruction';
  /** The source line, so anyone can check the rewrite against the original. */
  source: string;
}

/* ------------------------------------------------------------------ dosing */

/**
 * 500mg, 1g, 5ml, 400mcg, 1000iu — the amount in one dose.
 *
 * The leading `(?:\d+\s*\/\s*)?` keeps a combination strength whole: Lonart is written
 * "80/480mg" because it holds 80mg of one medicine and 480mg of another, and reporting only the
 * 480 describes a tablet that does not exist.
 */
const DOSE = /((?:\d+(?:\.\d+)?\s*\/\s*)?\d+(?:\.\d+)?)\s*(mg|g|mcg|ml|iu|units?)\b/i;

/** "2 tabs", "1 cap", "1 tablet" — how many to take, when the strength is written separately. */
const COUNT = /\b(\d+)\s*(tabs?|tablets?|caps?|capsules?|spoons?|sachets?|drops?)\b/i;

/**
 * How often. Order matters: the longer written forms are tried before the two-letter ones, or
 * "twice daily" would match the "bd" rule only by accident and "od" would fire inside "blood".
 */
const FREQUENCY: { re: RegExp; say: string }[] = [
  { re: /\bonce\s+(?:a\s+)?(?:day|daily)\b/i, say: 'once a day' },
  { re: /\btwice\s+(?:a\s+)?(?:day|daily)\b/i, say: 'twice a day' },
  { re: /\bthree\s+times\s+(?:a\s+)?(?:day|daily)\b/i, say: 'three times a day' },
  { re: /\bfour\s+times\s+(?:a\s+)?(?:day|daily)\b/i, say: 'four times a day' },
  { re: /\bevery\s+(?:4|four)\s*(?:hours|hrs|h)\b/i, say: 'every four hours' },
  { re: /\bevery\s+(?:6|six)\s*(?:hours|hrs|h)\b/i, say: 'every six hours' },
  { re: /\bevery\s+(?:8|eight)\s*(?:hours|hrs|h)\b/i, say: 'every eight hours' },
  { re: /\bevery\s+(?:12|twelve)\s*(?:hours|hrs|h)\b/i, say: 'every twelve hours' },
  { re: /\bq\s*4\s*h\b/i, say: 'every four hours' },
  { re: /\bq\s*6\s*h\b/i, say: 'every six hours' },
  { re: /\bq\s*8\s*h\b/i, say: 'every eight hours' },
  { re: /\bq\s*12\s*h\b/i, say: 'every twelve hours' },
  { re: /\bt\.?d\.?s\.?\b|\btid\b/i, say: 'three times a day' },
  { re: /\bq\.?d\.?s\.?\b|\bqid\b/i, say: 'four times a day' },
  { re: /\bb\.?d\.?\b|\bbid\b/i, say: 'twice a day' },
  { re: /\bo\.?d\.?\b/i, say: 'once a day' },
  // Bare "daily", last of the daily forms so "twice daily" and "three times daily" win first.
  { re: /\bdaily\b|\bevery\s+day\b/i, say: 'once a day' },
  { re: /\bnocte\b/i, say: 'at night' },
  { re: /\bmane\b/i, say: 'in the morning' },
  { re: /\bstat\b/i, say: 'straight away, as a single dose' },
];

/** Taken only when needed. Not a frequency — it modifies one. */
const AS_NEEDED = /\bp\.?r\.?n\.?\b|\bas\s+(?:required|needed)\b|\bwhen\s+(?:required|needed)\b/i;

/** How it goes in, where the note bothers to say. */
const ROUTE: { re: RegExp; say: string }[] = [
  { re: /\bp\.?o\.?\b|\bper\s+os\b|\bby\s+mouth\b|\boral(?:ly)?\b/i, say: 'by mouth' },
  { re: /\bi\.?v\.?\b|\bintravenous(?:ly)?\b/i, say: 'into a vein, through a drip' },
  { re: /\bi\.?m\.?\b|\bintramuscular(?:ly)?\b/i, say: 'as an injection into a muscle' },
  { re: /\bs\.?c\.?\b|\bsubcutaneous(?:ly)?\b/i, say: 'as an injection under the skin' },
  { re: /\btopical(?:ly)?\b|\bapply\b/i, say: 'on the skin' },
  { re: /\bp\.?v\.?\b|\bvaginal(?:ly)?\b/i, say: 'into the vagina' },
  { re: /\bp\.?r\.?\b(?!n)|\brectal(?:ly)?\b/i, say: 'into the rectum' },
];

function plural(n: number, one: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${one}s`;
}

/**
 * How long for.
 *
 * "x 5/7" is five days, "x 2/52" is two weeks, "x 3/12" is three months — a convention where the
 * denominator is the number of that unit in a year or a week. It is completely opaque unless you
 * have been taught it, which is exactly the sort of thing this file exists for.
 */
function duration(line: string): string | null {
  const shorthand = /(?:x|for)?\s*(\d+)\s*\/\s*(7|52|12)\b/i.exec(line);
  if (shorthand) {
    const n = Number(shorthand[1]);
    const unit = shorthand[2] === '7' ? 'day' : shorthand[2] === '52' ? 'week' : 'month';
    return `for ${plural(n, unit)}`;
  }
  const written = /\bfor\s+(\d+)\s*(day|week|month)s?\b/i.exec(line);
  if (written) return `for ${plural(Number(written[1]), written[2].toLowerCase())}`;
  const alsoWritten = /\bx\s*(\d+)\s*(day|week|month)s?\b/i.exec(line);
  if (alsoWritten) return `for ${plural(Number(alsoWritten[1]), alsoWritten[2].toLowerCase())}`;
  return null;
}

function firstMatch(line: string, table: { re: RegExp; say: string }[]): string | null {
  for (const { re, say } of table) if (re.test(line)) return say;
  return null;
}

/**
 * The instruction half of a medicine line, in plain words: what to take, how much, how often, how,
 * and for how long. Returns null when the line carries no dosing at all, which is how a plain
 * mention of a drug is told apart from a prescription of it.
 */
function instruction(line: string): string | null {
  const dose = DOSE.exec(line);
  const count = COUNT.exec(line);
  const frequency = firstMatch(line, FREQUENCY);
  const route = firstMatch(line, ROUTE);
  const asNeeded = AS_NEEDED.test(line);
  const howLong = duration(line);

  if (!dose && !count && !frequency && !howLong) return null;

  const amount: string[] = [];
  if (count) amount.push(plural(Number(count[1]), count[2].replace(/s$/i, '').toLowerCase()));
  if (dose) amount.push(`${dose[1].replace(/\s*\/\s*/, '/')}${dose[2].toLowerCase()}`);

  const parts: string[] = [];
  parts.push(amount.length > 0 ? `Take ${amount.join(' of ')}` : 'Take it');
  if (frequency) parts.push(asNeeded ? `${frequency}, but only when you need it` : frequency);
  else if (asNeeded) parts.push('only when you need it');
  if (route) parts.push(route);
  if (howLong) parts.push(howLong);

  return `${parts.join(', ')}.`;
}

/* ------------------------------------------------------------- composition */

/** "Ciprofloxacin (sold as Ciprotab)" when the note used the brand and the glossary knows both. */
function nameFor(term: Term, line: string): string {
  const tokens = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const canonical = term.name.toLowerCase();

  // If the note used the real name, say nothing further.
  if (tokens.includes(canonical)) return term.name;

  // Otherwise the longest alias actually present as a whole word. Longest matters: "cipro" and
  // "ciprotab" are both aliases of ciprofloxacin, and a note saying Ciprotab should be told back
  // "written here as Ciprotab" — naming the shorter one describes a box nobody was handed.
  const brand = (term.aliases ?? [])
    .filter((a) => a.toLowerCase() !== canonical && !canonical.includes(a.toLowerCase()))
    .filter((a) => {
      const words = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
      return words.every((w) => tokens.includes(w));
    })
    .sort((a, b) => b.length - a.length)[0];

  if (!brand) return term.name;
  const shown = brand.charAt(0).toUpperCase() + brand.slice(1);
  return `${term.name} (written here as ${shown})`;
}

/** A drug the glossary has never heard of, taken from the words around the dose. */
function unknownDrugName(line: string): string | null {
  const cleaned = line
    .replace(/^\s*(?:tabs?|tablets?|caps?|capsules?|syr|syrup|inj|injection|susp|suspension)\b\.?\s*/i, '')
    .trim();
  const word = /^([A-Za-z][A-Za-z-]{3,})/.exec(cleaned);
  if (!word) return null;
  const name = word[1];
  // Words that start a line but are not a medicine.
  if (/^(take|give|given|start|started|continue|advised|plan|review|follow|patient|note|diagnosis)$/i.test(name)) {
    return null;
  }
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Splits a note into the units a person reads: lines, then sentences inside long lines. */
function segments(note: string): string[] {
  return note
    .split(/\r?\n|(?<=[.;])\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter((s) => s.length > 2);
}

/**
 * The whole note, line by line, in plain words.
 *
 * One sentence per thing found, in the order the note puts them, so somebody can read down the
 * rewrite beside the original and see where each sentence came from. Lines that say nothing
 * worth rewriting produce nothing: a summary padded with "the note also mentions the date" is
 * how people learn to stop reading these.
 */
export function plainReport(note: string): PlainLine[] {
  const out: PlainLine[] = [];
  const seen = new Set<string>();

  for (const line of segments(note)) {
    const terms = findTerms(line);
    const dosing = instruction(line);
    const context = contextOf(line);

    // "Allergies: Penicillin" names a drug, and saying "penicillin is an antibiotic used to
    // treat bacterial infections" is both true and precisely the wrong sentence: it reads as a
    // prescription for the one medicine this person must never be given. The heading above a
    // line changes what the line means, so it is read first.
    if (context === 'allergy') {
      for (const term of terms.filter((t) => t.kind === 'drug' || t.kind === 'allergen' || t.kind === 'supplement')) {
        const reaction = /\(([^)]+)\)/.exec(line)?.[1]?.trim();
        push(out, seen, {
          text: `You are recorded as allergic to ${term.name.toLowerCase()}${reaction ? ` — the note says it ${lowerFirst(reaction)}` : ''}. ${term.name} is ${lowerFirst(term.plain)}`,
          kind: 'condition',
          source: line,
        });
      }
      if (terms.length > 0) continue;
    }

    const drugs = terms.filter((t) => t.kind === 'drug' || t.kind === 'supplement');
    const tests = terms.filter((t) => t.kind === 'test');
    const conditions = terms.filter((t) => t.kind === 'condition' || t.kind === 'allergen');

    if (drugs.length > 0) {
      for (const drug of drugs) {
        const sentence = [`${nameFor(drug, line)} — ${lowerFirst(drug.plain)}`, dosing].filter(Boolean).join(' ');
        push(out, seen, { text: sentence, kind: 'medicine', source: line });
      }
      continue;
    }

    // Dosing with no drug the glossary knows. The instruction is still the useful half, and it is
    // the half a brand name cannot hide.
    if (dosing) {
      const name = unknownDrugName(line);
      const sentence = name
        ? `${name} — this one is not in MedRekk's dictionary, so what it treats is not described here. ${dosing}`
        : dosing;
      push(out, seen, { text: sentence, kind: 'medicine', source: line });
      continue;
    }

    for (const test of tests) {
      const full = test.fullName ? `${test.name} (${test.fullName})` : test.name;
      push(out, seen, { text: `${full} — ${lowerFirst(test.plain)}`, kind: 'test', source: line });
    }
    for (const condition of conditions) {
      const lead =
        context === 'diagnosis'
          ? `The health worker recorded ${condition.name.toLowerCase()}. It is `
          : `${condition.name} — `;
      push(out, seen, { text: `${lead}${lowerFirst(condition.plain)}`, kind: 'condition', source: line });
    }

    /*
     * A diagnosis the glossary has never heard of.
     *
     * Restating the note's own words is not inventing anything, and a diagnosis is the line a
     * patient most wants rendered: "Working Diagnosis: non-specific acute abdominal pain (rule
     * out early acute appendicitis)" otherwise produces nothing at all, which reads as the app
     * having no opinion about the most important sentence on the page.
     *
     * "Rule out" is the piece of jargon that matters here. It does not mean the patient has the
     * thing — it means the opposite, that the clinician is checking whether they do — and read
     * the wrong way round it is frightening.
     */
    if (context === 'diagnosis' && conditions.length === 0) {
      const after = /:\s*(.+)$/.exec(line)?.[1] ?? line;
      const ruleOut = /\brule\s*(?:out|\/\s*o)\b[\s:]*(.+?)[).]*$/i.exec(after);
      const main = after.replace(/\(?\s*rule\s*(?:out|\/\s*o)\b.*$/i, '').replace(/[(,;\s]+$/, '').trim();

      const said: string[] = [];
      if (main.length > 0) said.push(`The health worker's working view was ${lowerFirst(main)}.`);
      if (ruleOut?.[1]) {
        said.push(
          `They also wanted to check whether it was ${lowerFirst(ruleOut[1].trim())} — "rule out" means they were testing for it, not that you have it.`,
        );
      }
      if (said.length > 0) {
        push(out, seen, { text: said.join(' '), kind: 'condition', source: line });
        continue;
      }
    }

    // Shorthand with nothing else in the line: "O/E: chest clear", "c/o headache x 3/7".
    if (tests.length === 0 && conditions.length === 0) {
      const abbreviations = terms.filter((t) => t.kind === 'abbreviation');
      for (const abbr of abbreviations) {
        push(out, seen, { text: `${abbr.name} — ${lowerFirst(abbr.plain)}`, kind: 'instruction', source: line });
      }
    }
  }

  return out;
}

/**
 * What the heading on a line says the line is for.
 *
 * Clinical notes carry their meaning in headings as much as in words, and the same drug name
 * means opposite things under "Prescribed" and under "Allergies".
 */
function contextOf(line: string): 'allergy' | 'diagnosis' | 'plain' {
  if (/\b(allerg|reacts? to|reaction to|sensitiv)/i.test(line)) return 'allergy';
  if (/\b(diagnos|impression|assessment)/i.test(line)) return 'diagnosis';
  return 'plain';
}

function push(out: PlainLine[], seen: Set<string>, line: PlainLine): void {
  const key = line.text.toLowerCase();
  if (seen.has(key)) return; // the same drug named twice in one note is one sentence
  seen.add(key);
  out.push(line);
}

/** The glossary's sentences start with a capital; here they continue one. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
