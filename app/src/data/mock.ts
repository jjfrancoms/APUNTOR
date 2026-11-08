/**
 * Datos de ejemplo para construir y revisar las vistas sin backend.
 * Reflejan los textos de las pantallas diseñadas. Se reemplazarán por la API.
 */

export interface User {
  name: string;
  fullName: string;
  email: string;
  level: string;
}

export interface Section {
  title: string;
  topics: { id: string; title: string }[];
}

export interface CourseClass {
  id: string;
  title: string;
  topicCount: number;
  /** 0–1 */
  progress: number;
  sections: Section[];
}

export interface Course {
  id: string;
  title: string;
  icon: 'book-open' | 'book';
  tone: 'primary' | 'accent' | 'neutral';
  classes: CourseClass[];
  topicCount: number;
  documentCount: number;
  /** 0–1 */
  progress: number;
}

export interface TopicDetail {
  id: string;
  courseId: string;
  breadcrumb: string[];
  title: string;
  own: { source: string; text: string };
  external: { source: string; text: string } | null;
  notes: string[];
}

export interface DocumentDetail {
  id: string;
  name: string;
  type: string;
  size: string;
  pages: number;
  uploaded: string;
  currentPage: number;
  classification: string[];
  topics: string[];
}

export interface SearchResult {
  id: string;
  kind: 'document' | 'chat';
  title: string;
  location: string;
  snippet: string;
  match: string;
  tag: string;
}

export const user: User = {
  name: 'Ana',
  fullName: 'Ana Torres',
  email: 'ana@correo.com',
  level: 'Universidad',
};

export const courses: Course[] = [
  {
    id: 'calculo-1',
    title: 'Cálculo I',
    icon: 'book-open',
    tone: 'primary',
    topicCount: 12,
    documentCount: 7,
    progress: 0.65,
    classes: [
      { id: 'c1', title: 'Clase 1 · Funciones', topicCount: 3, progress: 1, sections: [] },
      { id: 'c2', title: 'Clase 2 · Álgebra de límites', topicCount: 3, progress: 1, sections: [] },
      {
        id: 'c3',
        title: 'Clase 3 · Límites y continuidad',
        topicCount: 3,
        progress: 0.4,
        sections: [
          {
            title: 'TEORÍA',
            topics: [
              { id: 'definicion-limite', title: 'Definición de límite' },
              { id: 'limites-laterales', title: 'Límites laterales' },
            ],
          },
          { title: 'EJERCICIOS', topics: [{ id: 'practica-3', title: 'Práctica guiada 3' }] },
        ],
      },
      { id: 'c4', title: 'Clase 4 · Derivadas', topicCount: 3, progress: 0, sections: [] },
    ],
  },
  {
    id: 'fisica-2',
    title: 'Física II',
    icon: 'book',
    tone: 'accent',
    topicCount: 9,
    documentCount: 4,
    progress: 0.3,
    classes: [
      { id: 'f1', title: 'Clase 1 · Electrostática', topicCount: 3, progress: 0.6, sections: [] },
      { id: 'f2', title: 'Clase 2 · Dinámica', topicCount: 3, progress: 0.3, sections: [] },
      { id: 'f3', title: 'Clase 3 · Ondas', topicCount: 3, progress: 0, sections: [] },
    ],
  },
  {
    id: 'historia-peru',
    title: 'Historia del Perú',
    icon: 'book',
    tone: 'neutral',
    topicCount: 6,
    documentCount: 2,
    progress: 0.1,
    classes: [
      {
        id: 'h1',
        title: 'Clase 1 · Culturas preincas',
        topicCount: 3,
        progress: 0.2,
        sections: [],
      },
      { id: 'h2', title: 'Clase 2 · Virreinato', topicCount: 3, progress: 0, sections: [] },
    ],
  },
];

export const continueLearning = {
  topicId: 'definicion-limite',
  title: 'Definición de límite',
  location: 'Cálculo I · Clase 3 · Teoría',
  progress: 0.55,
};

export const todayReview = { topic: 'Límites laterales' };

export const topics: Record<string, TopicDetail> = {
  'definicion-limite': {
    id: 'definicion-limite',
    courseId: 'calculo-1',
    breadcrumb: ['Cálculo I', 'Clase 3', 'Teoría'],
    title: 'Definición de límite',
    own: {
      source: 'Apuntes de Cálculo I · p. 12',
      text: 'El límite de f(x) cuando x tiende a a es L si, para cada épsilon > 0, existe un delta > 0 tal que |x − a| < delta implica |f(x) − L| < épsilon.',
    },
    external: {
      source: 'Fuente de ejemplo',
      text: 'Al acercarte a a, los valores de f(x) se acercan a L: la gráfica se queda dentro de un "túnel" alrededor de L.',
    },
    notes: [
      'Tus apuntes usan la definición formal épsilon-delta; la fuente añade la idea gráfica.',
      'A tus apuntes les falta un ejemplo resuelto.',
    ],
  },
};

export const documents: Record<string, DocumentDetail> = {
  'limites-continuidad': {
    id: 'limites-continuidad',
    name: 'Límites y continuidad.pdf',
    type: 'PDF',
    size: '2.4 MB',
    pages: 34,
    uploaded: 'hoy',
    currentPage: 12,
    classification: ['Cálculo I', 'Clase 3', 'Límites'],
    topics: ['Definición de límite', 'Límites laterales', 'Continuidad'],
  },
};

export const searchQuery = 'límite lateral';

export const searchResults: SearchResult[] = [
  {
    id: 'r1',
    kind: 'document',
    title: 'Límites y continuidad.pdf',
    location: 'Página 14',
    snippet:
      '…el límite lateral por la derecha se calcula acercándose a a con valores mayores que a…',
    match: 'límite lateral',
    tag: 'Cálculo I › Clase 3',
  },
  {
    id: 'r2',
    kind: 'document',
    title: 'Cálculo – problemas.pdf',
    location: 'Página 3',
    snippet: 'Ejercicio 4: halla el límite lateral izquierdo de f en x = 2…',
    match: 'límite lateral',
    tag: 'Cálculo I › Clase 3',
  },
  {
    id: 'r3',
    kind: 'chat',
    title: 'Chat · Épsilon y delta',
    location: 'Hoy, 10:24',
    snippet: 'Mascota: el límite lateral existe solo si ambos lados coinciden…',
    match: 'límite lateral',
    tag: 'Cálculo I',
  },
  {
    id: 'r4',
    kind: 'document',
    title: 'Guía de repaso.docx',
    location: 'Página 2',
    snippet: 'Repasa el límite lateral antes de continuidad…',
    match: 'límite lateral',
    tag: 'Cálculo I',
  },
];

export function findCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

// --- Subida de documentos (pantallas 2, 17, 18, 16, 9, 41) -------------------

export type UploadStatus = 'ready' | 'analyzing' | 'queued' | 'processing' | 'uploading';

export interface UploadItem {
  id: string;
  name: string;
  ext: string;
  kind: string;
  size: string;
  status: UploadStatus;
  /** 0–1, solo para `uploading` / `processing`. */
  progress?: number;
  total?: string;
}

export const uploadPicking: UploadItem[] = [
  {
    id: 'u1',
    name: 'Apuntes de Cálculo I.pdf',
    ext: 'PDF',
    kind: 'PDF',
    size: '2.4 MB',
    status: 'ready',
  },
  {
    id: 'u2',
    name: 'Física II.pptx',
    ext: 'PPT',
    kind: 'PPTX',
    size: '8.1 MB',
    status: 'analyzing',
  },
  {
    id: 'u3',
    name: 'Foto de pizarra.jpg',
    ext: 'IMG',
    kind: 'Imagen',
    size: '1.2 MB',
    status: 'queued',
  },
];

export const uploadPlan = ['Cálculo I', 'Clase 3', 'Teoría'];

export const uploadProgress: UploadItem[] = [
  {
    id: 'p1',
    name: 'Límites y continuidad.pdf',
    ext: 'PDF',
    kind: 'PDF',
    size: '2.4 MB',
    status: 'ready',
  },
  { id: 'p2', name: 'Física II.pptx', ext: 'PPT', kind: 'PPTX', size: '8.1 MB', status: 'ready' },
  {
    id: 'p3',
    name: 'Historia del Perú.docx',
    ext: 'DOC',
    kind: 'DOCX',
    size: '1.2 MB',
    status: 'ready',
  },
  {
    id: 'p4',
    name: 'Problemas.pdf',
    ext: 'PDF',
    kind: 'PDF',
    size: '3.0 MB',
    status: 'processing',
    progress: 0.55,
  },
  {
    id: 'p5',
    name: 'Guía de laboratorio.pdf',
    ext: 'PDF',
    kind: 'PDF',
    size: '12 MB',
    status: 'uploading',
    progress: 0.64,
    total: '12 MB',
  },
];

export const storage = { usedMb: 480, totalMb: 500 };

export const reviewItems = [
  {
    id: 'r1',
    name: 'Límites y continuidad.pdf',
    ext: 'PDF',
    path: ['Cálculo I', 'Clase 3', 'Límites'],
    confident: true,
  },
  {
    id: 'r2',
    name: 'Física II.pptx',
    ext: 'PPT',
    path: ['Física II', 'Clase 2', 'Dinámica'],
    confident: true,
  },
  { id: 'r3', name: 'apuntes-clase.docx', ext: 'DOC', path: [], confident: false },
] as const;

export const processResults = [
  { id: 'e1', name: 'Apuntes de Cálculo I.pdf', kind: 'PDF · 2.4 MB', result: 'ready' },
  { id: 'e2', name: 'Foto de pizarra.jpg', kind: 'Imagen · 1.2 MB', result: 'unreadable' },
  { id: 'e3', name: 'Proyecto.zip', kind: 'ZIP · 3 MB', result: 'unsupported' },
] as const;

// --- OCR (28, 29) -------------------------------------------------------------

// --- Chat (5, 23, 24, 25, 10, 30) ----------------------------------------------

export const chatSample = {
  question: 'No entiendo la definición de límite con épsilon y delta',
  answer:
    'Te lo explico con tus apuntes (Clase 3, p. 12): imagina que alguien te reta a acercarte a L tanto como quieras. épsilon dice qué tan cerca; delta dice qué tan cerca de a debes estar para lograrlo.',
  page: 12,
  external: 1,
};

export const chatOffline = {
  question: '¿Qué es un límite lateral?',
  answer:
    'Según tus apuntes (Clase 3, p. 14), es el valor al que se acerca la función viniendo solo por un lado. El contexto externo lo sumo cuando vuelvas a conectarte.',
  page: 14,
};

export const chatOutside = {
  question: '¿Quién desarrolló el cálculo?',
  answer: 'Newton y Leibniz lo desarrollaron de forma independiente en el siglo XVII.',
  sourceTitle: 'Historia del cálculo',
  sourceHost: 'es.wikipedia.org',
};

export const dailyLimit = { used: 20, total: 20, renewsIn: '4 h 12 min' };

export const conversations = [
  {
    id: 'c1',
    group: 'today',
    title: 'Límite con épsilon y delta',
    time: '10:24',
    preview: 'Te lo explico con tus apuntes de la Clase 3…',
    course: 'Cálculo I',
  },
  {
    id: 'c2',
    group: 'today',
    title: 'Quiz de dinámica',
    time: '08:02',
    preview: 'Respondiste 8 de 10. Repasemos la tercera ley…',
    course: 'Física II',
  },
  {
    id: 'c3',
    group: 'week',
    title: 'Resumen de las culturas preincas',
    time: 'Mar',
    preview: 'Resumen de 5 puntos con tu presentación…',
    course: 'Historia del Perú',
  },
  {
    id: 'c4',
    group: 'week',
    title: 'Derivadas: regla de la cadena',
    time: 'Lun',
    preview: 'Aquí tienes dos ejemplos resueltos…',
    course: 'Cálculo I',
  },
] as const;

// --- Estudio (31, 21, 22, 32) ---------------------------------------------------

export const quizSetupData = {
  topic: 'Límites y continuidad',
  location: 'Cálculo I · Clase 3',
  documents: 3,
  minutes: 8,
  amounts: ['5', '10', '20'] as const,
};

export const quizSession = {
  topic: 'Límites',
  location: 'Cálculo I · Clase 3',
  current: 3,
  total: 10,
};

export const quizQuestions = [
  {
    id: 'q3',
    prompt: '¿Qué describe mejor el límite lateral por la derecha de f en x = a?',
    options: [
      'El valor de f en x = a',
      'El valor al que se acerca f(x) cuando x se acerca a a con valores mayores que a',
      'El valor al que se acerca f(x) cuando x crece sin límite',
      'La pendiente de la recta tangente en a',
    ],
    answer: 1,
    klass: 3,
    page: 14,
    explanation:
      'Por la derecha significa que x se acerca a a tomando solo valores mayores que a. Por eso la correcta es la B.',
  },
  {
    id: 'q4',
    prompt: 'En la definición épsilon-delta, ¿qué controla delta?',
    options: [
      'Qué tan cerca está f(x) de L',
      'Qué tan cerca está x de a',
      'El valor de L',
      'La pendiente de f',
    ],
    answer: 1,
    klass: 3,
    page: 12,
    explanation:
      'Delta fija qué tan cerca de a debe estar x para que f(x) quede a menos de épsilon de L.',
  },
  {
    id: 'q5',
    prompt: '¿Cuándo existe el límite de f(x) cuando x tiende a a?',
    options: [
      'Cuando f(a) está definida',
      'Cuando los límites laterales existen y coinciden',
      'Siempre que f sea un polinomio',
      'Cuando f(x) crece sin cota',
    ],
    answer: 1,
    klass: 3,
    page: 14,
    explanation: 'El límite existe solo si ambos límites laterales existen y coinciden.',
  },
  {
    id: 'q6',
    prompt: '¿Qué condición NO es necesaria para que f sea continua en a?',
    options: [
      'f(a) está definida',
      'El límite en a existe',
      'El límite coincide con f(a)',
      'f es derivable en a',
    ],
    answer: 3,
    klass: 3,
    page: 16,
    explanation:
      'La continuidad pide que f(a) exista, que exista el límite y que coincidan; no exige derivabilidad.',
  },
  {
    id: 'q7',
    prompt: 'Para f(x) = (x² − 4)/(x − 2), ¿cuánto vale el límite cuando x tiende a 2?',
    options: ['0', '2', '4', 'No existe'],
    answer: 2,
    klass: 3,
    page: 3,
    explanation: 'Al factorizar, (x − 2)(x + 2)/(x − 2) = x + 2, que vale 4 cuando x tiende a 2.',
  },
];

export const flashcardSession = { location: 'Cálculo I · Clase 3', current: 4, total: 12 };

export const flashcards = [
  {
    id: 'f4',
    front: 'Límite lateral derecho',
    back: 'Valor al que se acerca f(x) cuando x se acerca a a con valores mayores que a.',
    klass: 3,
    page: 14,
  },
  {
    id: 'f5',
    front: 'Función continua en a',
    back: 'f(a) existe, el límite en a existe y ambos coinciden.',
    klass: 3,
    page: 16,
  },
  {
    id: 'f6',
    front: 'Definición épsilon-delta',
    back: 'Para cada ε > 0 existe δ > 0 tal que |x − a| < δ implica |f(x) − L| < ε.',
    klass: 3,
    page: 12,
  },
];

export const reviewToday = {
  cards: 12,
  minutes: 6,
  byCourse: [
    { course: 'Cálculo I', cards: 7 },
    { course: 'Física II', cards: 5 },
  ],
};

// --- Planes y suscripción (26, 38) — cifras de ejemplo --------------------------

export const plans = {
  freePrice: 'S/ 0',
  studentPrice: 'S/ 14',
  reviewTime: '8:00 p. m.',
  renewDate: '30 de noviembre',
  paymentMethod: 'Google Play',
};

// --- Compartir (35, 36, 37) ------------------------------------------------------

export const sharedSummary = {
  title: 'Límites y continuidad',
  course: 'Cálculo I',
  excerpt:
    'El límite describe el valor al que se acerca f(x) cuando x se acerca a a. Por la derecha y por la izquierda…',
  points: [
    'El límite describe el valor al que se acerca f(x) cuando x se acerca a a.',
    'Por la derecha y por la izquierda deben coincidir para que el límite exista.',
    'Una función es continua en a si el límite en a es igual a f(a).',
  ],
  link: 'app.ejemplo.pe/r/Xk3m9',
  expires: '29 nov',
};

// --- Borrar cuenta (40, 52) -------------------------------------------------------

export const accountTotals = { documents: 7, courses: 3, conversations: 24 };
