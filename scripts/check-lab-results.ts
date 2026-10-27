/**
 * What the lab reader makes of real-shaped report lines.
 *
 * Run with `npm run check:lab`. Like its sibling for plain language, this is for reading rather
 * than asserting: the question is whether a sentence is honest about what it does and does not
 * know, which a person judges. Every case below earned its place by being wrong once.
 */
import { readLabReport, standingSentence, meaningSentence, nextStepSentence } from '../src/features/ai/labResults';

const CASES: { label: string; note: string; watch: string }[] = [
  {
    label: 'A full blood count, every format at once',
    note: `FULL BLOOD COUNT
Haemoglobin (Hb) .......... 10.8 g/dL   (12.0 - 16.0)
White Cell Count: 11.2 x10^9/L [4.0 – 11.0]
Platelets 250 x10^9/L (150-400)
MCV 72 fL (80.0-100.0)
Random Blood Sugar: 92 mg/dL
Malaria RDT: Positive
HIV screening: Non-reactive
Widal: equivocal
Collected 26/10/2026`,
    watch: 'Dot leaders, colons, square and round brackets, en dash and hyphen all read. "Collected 26/10/2026" must NOT become a result.',
  },
  {
    label: 'No reference range printed',
    note: 'Haemoglobin: 10.8 g/dL',
    watch: 'Must say it cannot judge this, and must NOT supply a range of its own.',
  },
  {
    label: 'No unit printed',
    note: 'Haemoglobin 10.8 (12.0-16.0)',
    watch: 'Still compares, but flags the missing unit.',
  },
  {
    label: 'Range printed backwards',
    note: 'Haemoglobin 10.8 g/dL (16.0-12.0)',
    watch: 'Declines to compare, and must not then describe a comparison anyway.',
  },
  {
    label: 'Ref: prefix with "to" separator',
    note: 'Haemoglobin 10.8 g/dL Ref: 12.0 to 16.0',
    watch: 'The colon inside "Ref:" must not be taken as the name/value separator.',
  },
  {
    label: 'Header lines that are not results',
    note: `St Jude General Hospital
Collected 26/10/2026
Dr Jane Doe
Specimen: whole blood`,
    watch: 'Nothing at all.',
  },
];

for (const { label, note, watch } of CASES) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  console.log(`  \x1b[2mwatch: ${watch}\x1b[0m`);
  const r = readLabReport(note);
  for (const f of r.findings) {
    console.log(`  [${f.standing}] ${standingSentence(f)}`);
    const m = meaningSentence(f);
    if (m) console.log(`        ${m}`);
    for (const c of f.concerns) console.log(`        ! ${c}`);
  }
  for (const o of r.outcomes) console.log(`  [${o.outcome}] ${o.label}`);
  const step = nextStepSentence(r);
  if (step) console.log(`  -> ${step}`);
  if (r.findings.length === 0 && r.outcomes.length === 0) console.log('  (nothing read)');
}
console.log('');
