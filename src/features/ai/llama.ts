import { initLlama, type CompletionParams, type LlamaContext } from 'llama.rn';
import { CLAIM_CATEGORIES, type ClaimCategory, type DraftItem } from '@/features/worker/workerApi';
import { modelPath } from './modelStore';

let context: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;

/** Converted to a grammar by llama.rn, so the model cannot emit anything outside this shape. */
const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...CLAIM_CATEGORIES] },
          value: { type: 'string', maxLength: 120 },
          excerpt: { type: 'string', maxLength: 400 },
        },
        required: ['category', 'value', 'excerpt'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM = [
  'You extract facts from a clinical note into structured data.',
  'ALLERGIES means only a substance that HARMS the patient: they are allergic to it, or it gives them a reaction.',
  'A medicine the patient TAKES is CURRENT_MEDICATIONS, never ALLERGIES, even if it is named in the same sentence as an allergy.',
  'Example: "allergic to penicillin and takes amoxicillin" gives ALLERGIES: Penicillin, and CURRENT_MEDICATIONS: Amoxicillin.',
  'Skip any medicine the patient has stopped, run out of, or is no longer taking. Do not list it at all.',
  'Skip anything the note denies, such as "no fever" or "no known allergies".',
  'Each "value" is A SHORT fact of a few words, never a sentence copied from the note.',
  'Put each separate fact in its own item. Never put two allergies or two drugs in one item.',
  'Only use information stated in the note. Never infer a diagnosis, never suggest treatment,',
  'and never mention any drug or dose that is not written in the note.',
  'The "excerpt" must be the exact words from the note that the fact came from.',
  'If nothing can be extracted, return an empty items array.',
].join(' ');

export async function loadModel(): Promise<LlamaContext> {
  if (context) return context;
  if (!loading) {
    loading = initLlama({
      model: modelPath.replace('file://', ''),
      n_ctx: 2048,
      n_gpu_layers: 0,
    })
      .then((ctx) => {
        context = ctx;
        loading = null;
        return ctx;
      })
      .catch((e: unknown) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

export async function releaseModel(): Promise<void> {
  if (!context) return;
  await context.release();
  context = null;
}

interface RawItem {
  category?: unknown;
  value?: unknown;
  excerpt?: unknown;
}

/** Model output is data, never fact: anything unexpected is dropped rather than shown to a worker. */
const NEGATION = /\b(no|not|denies|without|never)\b[^.;]{0,30}$/i;
const STOPPED = /\b(stopped|used to|no longer|discontinued|switched|ran out|came off|former(ly)?)\b[^.;]{0,60}$/i;
const DOSE = /\b\d+(\.\d+)?\s?(mg|mcg|ml|g|units?|tablets?)\b/gi;

const flat = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ');

/** A dose the note never contained is an invention, and the most dangerous thing the model can emit. */
function stripInventedDoses(value: string, rawInput: string): string {
  const source = flat(rawInput);
  let out = value;
  for (const match of value.match(DOSE) ?? []) {
    if (!source.includes(flat(match))) out = out.replace(match, '').replace(/\s{2,}/g, ' ').trim();
  }
  return out.replace(/[,\s]+$/, '');
}


/** The same fact in two categories is one mistake, not two facts. */
function keyOf(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function clean(parsed: unknown, rawInput: string): DraftItem[] {
  if (typeof parsed !== 'object' || parsed === null) return [];
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  const out: DraftItem[] = [];
  const seen = new Set<string>();
  for (const entry of items as RawItem[]) {
    const category = entry.category;
    const value = entry.value;
    if (typeof category !== 'string' || typeof value !== 'string') continue;
    if (!CLAIM_CATEGORIES.includes(category as ClaimCategory)) continue;
    const trimmed = value.trim();
    if (trimmed.length < 2) continue;
    const key = keyOf(trimmed);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);

    const firstWord = key.split(' ')[0] ?? '';
    const at = rawInput.toLowerCase().indexOf(firstWord);
    const before = at > 0 ? rawInput.slice(0, at) : '';
    if (NEGATION.test(before)) continue;
    // A medicine the note says was stopped is not a current medicine.
    if (category === 'CURRENT_MEDICATIONS' && STOPPED.test(before)) continue;

    const safeValue = stripInventedDoses(trimmed, rawInput);
    if (safeValue.length < 2) continue;

    const excerpt = typeof entry.excerpt === 'string' ? entry.excerpt.trim() : '';
    out.push({
      category: category as ClaimCategory,
      value: safeValue,
      excerpt: excerpt.length > 1 && rawInput.includes(excerpt) ? excerpt : rawInput,
    });
  }
  return out;
}

export async function completeText(system: string, user: string, maxTokens: number): Promise<string> {
  const ctx = await loadModel();
  const result = await ctx.completion({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${user}\n\n/no_think` },
    ],
    n_predict: maxTokens,
    temperature: 0.2,
  });
  return (result.text ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export async function structureWithModel(rawInput: string): Promise<DraftItem[]> {
  const ctx = await loadModel();
  const params: CompletionParams = {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Note:\n${rawInput}\n\n/no_think` },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { schema: SCHEMA, strict: true },
    },
    n_predict: 512,
    temperature: 0.1,
  };
  const result = await ctx.completion(params);
  const text = (result.text ?? '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  try {
    return clean(JSON.parse(text.slice(start, end + 1)), rawInput);
  } catch {
    return [];
  }
}
