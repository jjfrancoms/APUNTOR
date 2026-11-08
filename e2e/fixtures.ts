/**
 * Datos de prueba de los tests de extremo a extremo. Son los que "responde" el servidor falso:
 * nada sale a Supabase, a la API real ni a ningún servicio externo.
 */
import { LEGAL_VERSION } from '../app/src/i18n/legal';

/** Hosts falsos a los que apunta la app durante los tests (ver `playwright.config.ts`). */
export const FAKE_API_URL = 'http://api.e2e.test';
export const FAKE_SUPABASE_URL = 'http://supabase.e2e.test';
export const FAKE_SUPABASE_KEY = 'sb_publishable_e2e_clave_falsa';

/** Contraseña que acepta el Supabase falso; cualquier otra devuelve `invalid_credentials`. */
export const PASSWORD_OK = 'clave-correcta-123';

export const COURSE = { id: 'c1', title: 'Lógica', createdAt: '2026-10-01T10:00:00.000Z' };

export const DOCUMENT = {
  id: 'd1',
  courseId: 'c1',
  title: 'logica.pdf',
  sizeBytes: 1_200_000,
  status: 'completed' as const,
  totalPages: 12,
  topicCount: 3,
  // Sin sugerencia pendiente: el curso lo eligió la persona.
  classificationStatus: 'confirmed' as 'none' | 'suggested' | 'confirmed' | 'dismissed',
  suggestedCourseId: null as string | null,
  suggestedCourseTitle: null as string | null,
  suggestionConfidence: null as number | null,
  suggestionReason: null as string | null,
  createdAt: '2026-10-02T10:00:00.000Z',
};

/** Documento recién subido al que la IA sugiere un curso: espera la decisión (pantalla 16). */
export const SUGGESTED_DOCUMENT = {
  ...DOCUMENT,
  id: 'd2',
  courseId: null as string | null,
  title: 'derecho-penal.pdf',
  classificationStatus: 'suggested' as 'none' | 'suggested' | 'confirmed' | 'dismissed',
  suggestedCourseId: COURSE.id as string | null,
  suggestedCourseTitle: COURSE.title as string | null,
  suggestionConfidence: 0.9 as number | null,
  suggestionReason: 'Habla de proposiciones y tablas de verdad.' as string | null,
};

/** Dos temas principales; "Proposiciones" tiene una sección dentro. */
export const TOPICS = [
  { id: 't1', parentId: null, title: 'Proposiciones', sourcePages: [1, 2, 3] },
  { id: 't2', parentId: 't1', title: 'Conectivos lógicos', sourcePages: [2, 3] },
  { id: 't3', parentId: null, title: 'Tablas de verdad', sourcePages: [4, 5, 6] },
];

export const USAGE = {
  questionsToday: 3,
  questionsLimit: 20,
  storageBytes: 1_200_000,
  storageLimit: 500_000_000,
  studyGenerationsToday: 2,
  studyGenerationsLimit: 10,
};

const pageImage = (pageNumber: number) => ({
  pageNumber,
  url: `http://api.e2e.test/paginas/${pageNumber}.png`,
  width: 800,
  height: 1100,
});

/** Frases del resumen: los tests las buscan en pantalla. */
export const SUMMARY_TEXT = {
  heading: 'Valores de verdad',
  paragraph: 'Una tabla de verdad enumera todos los valores posibles de una proposición.',
  tableHeader: ['p', 'q', 'p ∧ q'],
  tableRows: [
    ['V', 'V', 'V'],
    ['V', 'F', 'F'],
  ],
  formula: 'p ∧ q ≡ q ∧ p',
  unverified: 'Este párrafo no se pudo comprobar contra el documento.',
};

/** Resumen del tema "Tablas de verdad": título, tabla, fórmula y un bloque sin verificar. */
export const TOPIC_SUMMARY = {
  topic: TOPICS[2],
  path: ['logica.pdf', 'Tablas de verdad'],
  blocks: [
    { type: 'heading', text: SUMMARY_TEXT.heading },
    { type: 'paragraph', text: SUMMARY_TEXT.paragraph, pages: [4] },
    {
      type: 'table',
      header: SUMMARY_TEXT.tableHeader,
      rows: SUMMARY_TEXT.tableRows,
      pages: [4],
    },
    { type: 'formula', text: SUMMARY_TEXT.formula, pages: [5] },
    { type: 'paragraph', text: SUMMARY_TEXT.unverified, pages: [6], unverified: true },
  ],
  pageImages: [pageImage(4), pageImage(5), pageImage(6)],
  document: { id: DOCUMENT.id, title: DOCUMENT.title },
};

/** Resultados de la búsqueda: un documento, un tema y un fragmento de los apuntes. */
export const SEARCH_WORD = 'tautología';
export const SEARCH_RESULTS = {
  documents: [{ id: DOCUMENT.id, title: DOCUMENT.title }],
  topics: [
    {
      id: 't1',
      documentId: DOCUMENT.id,
      documentTitle: DOCUMENT.title,
      title: 'Proposiciones',
      pages: [1, 2, 3],
    },
  ],
  snippets: [
    {
      chunkId: 'ch1',
      documentId: DOCUMENT.id,
      documentTitle: DOCUMENT.title,
      pageNumber: 3,
      snippet: 'Una tautología es una proposición siempre verdadera.',
      highlights: [{ start: 4, length: 10 }],
    },
  ],
};

/** Respuesta con estructura: término, fórmula, explicación y página citada. */
export const ANSWER_CLAIM = {
  label: 'Tautología',
  formula: 'p ∨ ¬p',
  text: 'Es una proposición que siempre resulta verdadera.',
  page: 3,
};

export const ANSWER = {
  status: 'answered' as const,
  claims: [
    {
      label: ANSWER_CLAIM.label,
      formula: ANSWER_CLAIM.formula,
      text: ANSWER_CLAIM.text,
      citations: [
        {
          chunkId: 'ch1',
          documentId: DOCUMENT.id,
          pageNumber: ANSWER_CLAIM.page,
          quote: 'Una tautología es una proposición siempre verdadera.',
        },
      ],
    },
  ],
};

/** Aceptación vigente de los dos documentos legales. */
export const CONSENTS_CURRENT = {
  consents: (['terms', 'privacy'] as const).map((document) => ({
    document,
    version: LEGAL_VERSION,
    acceptedAt: '2026-11-01T10:00:00.000Z',
  })),
};

/** Aceptación de una versión anterior: la app debe volver a pedirla. */
export const CONSENTS_OUTDATED = {
  consents: (['terms', 'privacy'] as const).map((document) => ({
    document,
    version: '2020-01-01',
    acceptedAt: '2020-01-02T10:00:00.000Z',
  })),
};

export const EXPORT_DATA = { user: { email: 'ana@e2e.test' }, documents: [DOCUMENT] };

export const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'ana@e2e.test',
  fullName: 'Ana Torres',
  firstName: 'Ana',
};

const STUDY_CITATION = {
  chunkId: 'ch1',
  documentId: DOCUMENT.id,
  pageNumber: 3,
  quote: 'Una tautología es una proposición siempre verdadera.',
};

const studySet = (id: string, kind: 'quiz' | 'cards') => ({
  id,
  documentId: DOCUMENT.id,
  documentTitle: DOCUMENT.title,
  topicId: null,
  topicTitle: null,
  kind,
  itemCount: 1,
  lastScore: null,
  lastTotal: null,
  createdAt: '2026-11-08T10:00:00.000Z',
});

/** Quiz de una pregunta con su cita; el servidor falso lo devuelve al generar y al abrirlo. */
export const QUIZ = {
  set: studySet('s-quiz', 'quiz'),
  items: [
    {
      id: 'i-quiz',
      kind: 'quiz' as const,
      citation: STUDY_CITATION,
      question: '¿Qué es una tautología?',
      options: ['Siempre verdadera', 'Siempre falsa', 'Depende de los valores'],
      correctIndex: 0,
      explanation: 'Una tautología es verdadera con cualquier valor de sus variables.',
    },
  ],
};

/** Juego de una tarjeta. */
export const CARDS = {
  set: studySet('s-cards', 'cards'),
  items: [
    {
      id: 'i-card',
      kind: 'cards' as const,
      citation: STUDY_CITATION,
      front: 'Contradicción',
      back: 'Proposición siempre falsa.',
    },
  ],
};
