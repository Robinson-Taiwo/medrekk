/**
 * What the plain-language rewriter makes of a set of real-shaped notes.
 *
 * Run with `npm run check:plain` and read the output. This is not an assertion suite — the right
 * answer here is a judgement about whether a sentence reads plainly, which a human makes and a
 * matcher cannot. It exists so that a change to the parser or the glossary can be checked against
 * the cases that have already caught something, rather than against whatever note comes to mind.
 *
 * Cases below earned their place by being wrong once.
 */
import { plainReport } from '../src/features/ai/plainLanguage';

const CASES: { label: string; note: string; watch: string }[] = [
  {
    label: 'Nigerian brand plus shorthand duration',
    note: 'Tab Ciprotab 500mg BD x 4/7 for cough',
    watch: 'Names ciprofloxacin, credits Ciprotab (not "Cipro"), reads 4/7 as four days.',
  },
  {
    label: 'Canonical name, no brand',
    note: 'Tab Ciprofloxacin 500mg bd x 5/7 po',
    watch: 'No "written here as" clause at all when the note used the real name.',
  },
  {
    label: 'An allergy, not a prescription',
    note: 'Allergies: Penicillin (causes mild skin rash).',
    watch: 'Must say the patient is ALLERGIC. Describing penicillin as a treatment here is the worst output this file can produce.',
  },
  {
    label: 'Combination strength',
    note: 'Lonart 80/480mg bd x 3/7',
    watch: '80/480mg kept whole — 480mg alone describes a tablet that does not exist.',
  },
  {
    label: 'Drug outside the glossary',
    note: 'Tab Zymax 250mg tds x 7/7',
    watch: 'Dosing still explained; what it treats left unsaid rather than guessed.',
  },
  {
    label: 'Written-out frequency and as-needed',
    note: 'Paracetamol 500 mg every 6 hours as needed for pain/fever.',
    watch: '"every six hours" and "only when you need it" both present.',
  },
  {
    label: 'Heading that is not an abbreviation',
    note: 'Chief Complaint: Acute lower-right abdominal pain and low-grade fever for 24 hours.',
    watch: 'Must NOT explain "c/o" — the alias "co" used to match inside "complaint".',
  },
  {
    label: 'Diagnosis outside the glossary, with "rule out"',
    note: 'Working Diagnosis: Non-specific acute abdominal pain (rule out early acute appendicitis).',
    watch: 'Must make clear that "rule out" means checking FOR appendicitis, not that the patient has it.',
  },
  {
    label: 'A whole visit',
    note: `Hospital: St Jude General Hospital. Dr Jane Doe.
Working Diagnosis: non-specific acute abdominal pain.
Diagnostics Ordered: Complete Blood Count (CBC), Urinalysis.
Medications Prescribed: Paracetamol 500 mg every 6 hours as needed.
Current Medications: Cetirizine 10 mg oral daily as needed.
Allergies: Penicillin (causes mild skin rash).`,
    watch: 'Each line rewritten once, in order, nothing padded or repeated.',
  },
];

for (const { label, note, watch } of CASES) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  console.log(`  \x1b[2mwatch: ${watch}\x1b[0m`);
  const lines = plainReport(note);
  if (lines.length === 0) console.log('  \x1b[31m(nothing produced)\x1b[0m');
  for (const line of lines) console.log(`  [${line.kind}] ${line.text}`);
}
console.log('');
