import { z } from 'zod';
import type { RetrievedChunk } from './retriever';

/** Lo que se pide al modelo: cada afirmación con el fragmento y la cita que la sostienen. */
export const ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    answer_found: { type: 'boolean' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          formula: { type: 'string' },
          text: { type: 'string' },
          citations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fragment_id: { type: 'string' },
                quote: { type: 'string' },
              },
              required: ['fragment_id', 'quote'],
            },
          },
        },
        required: ['text', 'citations'],
      },
    },
  },
  required: ['answer_found', 'claims'],
} as const;

const modelAnswerSchema = z.object({
  answer_found: z.boolean(),
  claims: z.array(
    z.object({
      label: z.string().optional(),
      formula: z.string().optional(),
      text: z.string(),
      citations: z.array(z.object({ fragment_id: z.string(), quote: z.string() })),
    }),
  ),
});

export interface VerifiedCitation {
  chunkId: string;
  documentId: string;
  /** Sale del fragmento recuperado, nunca del modelo. */
  pageNumber: number;
  quote: string;
}

export interface VerifiedClaim {
  /** Término que explica la afirmación ("Negación"), solo si aparece en el fragmento citado. */
  label?: string;
  /** Notación ("¬p"), solo si aparece tal cual (sin contar espacios) en el fragmento citado. */
  formula?: string;
  text: string;
  citations: VerifiedCitation[];
}

export type RejectionReason =
  | 'invalid_json'
  | 'model_abstained'
  | 'no_claims'
  | 'claim_without_citation'
  | 'unknown_fragment'
  | 'quote_not_found'
  | 'quote_too_short'
  | 'incoherent_claim';

export type CitationValidation =
  { valid: true; claims: VerifiedClaim[] } | { valid: false; reason: RejectionReason };

/** Mínimo de palabras de una cita: "ATP" solo no prueba nada. */
export const MIN_QUOTE_WORDS = 3;
/** Parte de las palabras de la afirmación que debe aparecer en sus citas. Se calibra con eval/. */
export const MIN_CLAIM_OVERLAP = 0.5;

const STOPWORDS = new Set(
  (
    'que del los las una uno unos unas por para con como mas pero sus este esta estos estas ese esa ' +
    'son fue era ser hay muy tambien entre sobre cuando donde porque the and for with that this these ' +
    'those are was were has have from which its'
  ).split(' '),
);
const NEGATIONS = new Set(['no', 'ni', 'nunca', 'jamas', 'tampoco', 'not', 'never', 'none']);

/** El prompt escapa estas entidades: el modelo puede copiarlas tal cual en la cita. */
function unescapePromptEntities(text: string): string {
  return text.replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/&amp;/gu, '&');
}

function normalizeLiteral(text: string): string {
  return unescapePromptEntities(text).normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function wordsOf(text: string): string[] {
  return (
    normalizeLiteral(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

/** Raíz burda: basta para que "produce" y "producen" cuenten como la misma palabra. */
function stem(word: string): string {
  return word.slice(0, 5);
}

export function isCoherent(claim: string, quotes: readonly string[]): boolean {
  const claimWords = wordsOf(claim);
  const quoteWords = quotes.flatMap(wordsOf);
  const quoteSet = new Set(quoteWords);
  const quoteStems = new Set(quoteWords.map(stem));

  // Una cifra de la afirmación tiene que estar en la cita, tal cual.
  if (claimWords.some((w) => /\d/u.test(w) && !quoteSet.has(w))) return false;
  // "No produce ATP" no se sostiene con "produce ATP", ni al revés.
  const negated = (words: readonly string[]): boolean => words.some((w) => NEGATIONS.has(w));
  if (negated(claimWords) !== negated(quoteWords)) return false;

  const content = claimWords.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (content.length === 0) return false;
  const supported = content.filter((w) => quoteStems.has(stem(w))).length;
  return supported / content.length >= MIN_CLAIM_OVERLAP;
}

const MAX_LABEL_CHARS = 80;
const MAX_FORMULA_CHARS = 120;
const compact = (text: string): string => normalizeLiteral(text).replace(/\s+/gu, '');

/**
 * Término y notación son adornos de presentación: si no están en los fragmentos citados se
 * descartan (no invalidan la respuesta, que ya se sostiene con su cita).
 */
function supportedExtras(
  claim: { label?: string | undefined; formula?: string | undefined },
  sources: readonly string[],
): { label?: string; formula?: string } {
  const extras: { label?: string; formula?: string } = {};
  const label = claim.label === undefined ? '' : normalizeLiteral(claim.label);
  if (label.length > 0 && label.length <= MAX_LABEL_CHARS) {
    const wanted = wordsOf(label).join(' ');
    if (wanted.length > 0 && sources.some((s) => wordsOf(s).join(' ').includes(wanted))) {
      extras.label = label;
    }
  }
  const formula = claim.formula === undefined ? '' : normalizeLiteral(claim.formula);
  if (formula.length > 0 && formula.length <= MAX_FORMULA_CHARS) {
    const wanted = compact(formula);
    if (sources.some((s) => compact(s).includes(wanted))) extras.formula = formula;
  }
  return extras;
}

/**
 * Comprueba una cita contra los fragmentos: que el fragmento exista, que la cita tenga al menos
 * `MIN_QUOTE_WORDS` palabras y que esté literal en él. La página sale del fragmento.
 */
export function verifyCitation(
  citation: { fragment_id: string; quote: string },
  byId: ReadonlyMap<string, RetrievedChunk>,
):
  | { ok: true; citation: VerifiedCitation }
  | { ok: false; reason: 'unknown_fragment' | 'quote_too_short' | 'quote_not_found' } {
  const chunk = byId.get(citation.fragment_id);
  if (!chunk) return { ok: false, reason: 'unknown_fragment' };
  const quote = normalizeLiteral(citation.quote);
  if (wordsOf(quote).length < MIN_QUOTE_WORDS) return { ok: false, reason: 'quote_too_short' };
  if (!normalizeLiteral(chunk.content).includes(quote)) {
    return { ok: false, reason: 'quote_not_found' };
  }
  return {
    ok: true,
    citation: {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      pageNumber: chunk.pageNumber,
      quote,
    },
  };
}

/**
 * Valida la respuesta contra los fragmentos recuperados: id del fragmento, cita literal
 * y coherencia con la afirmación. Basta un fallo para rechazar la respuesta entera.
 */
export function validateAnswer(
  rawJson: string,
  chunks: readonly RetrievedChunk[],
): CitationValidation {
  let json: unknown;
  try {
    json = JSON.parse(rawJson);
  } catch {
    return { valid: false, reason: 'invalid_json' };
  }
  const parsed = modelAnswerSchema.safeParse(json);
  if (!parsed.success) return { valid: false, reason: 'invalid_json' };
  if (!parsed.data.answer_found) return { valid: false, reason: 'model_abstained' };
  if (parsed.data.claims.length === 0) return { valid: false, reason: 'no_claims' };

  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const claims: VerifiedClaim[] = [];

  for (const claim of parsed.data.claims) {
    if (claim.citations.length === 0) return { valid: false, reason: 'claim_without_citation' };
    const citations: VerifiedCitation[] = [];
    for (const citation of claim.citations) {
      const verified = verifyCitation(citation, byId);
      if (!verified.ok) return { valid: false, reason: verified.reason };
      citations.push(verified.citation);
    }
    if (
      !isCoherent(
        claim.text,
        citations.map((c) => c.quote),
      )
    ) {
      return { valid: false, reason: 'incoherent_claim' };
    }
    const sources = [...new Set(citations.map((c) => c.chunkId))].flatMap((id) => {
      const chunk = byId.get(id);
      return chunk ? [chunk.content] : [];
    });
    claims.push({ ...supportedExtras(claim, sources), text: claim.text.trim(), citations });
  }
  return { valid: true, claims };
}
