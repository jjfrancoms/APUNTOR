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

function isCoherent(claim: string, quotes: readonly string[]): boolean {
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
      const chunk = byId.get(citation.fragment_id);
      if (!chunk) return { valid: false, reason: 'unknown_fragment' };
      const quote = normalizeLiteral(citation.quote);
      if (wordsOf(quote).length < MIN_QUOTE_WORDS) {
        return { valid: false, reason: 'quote_too_short' };
      }
      if (!normalizeLiteral(chunk.content).includes(quote)) {
        return { valid: false, reason: 'quote_not_found' };
      }
      citations.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        pageNumber: chunk.pageNumber,
        quote,
      });
    }
    if (
      !isCoherent(
        claim.text,
        citations.map((c) => c.quote),
      )
    ) {
      return { valid: false, reason: 'incoherent_claim' };
    }
    claims.push({ text: claim.text.trim(), citations });
  }
  return { valid: true, claims };
}
