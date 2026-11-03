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

export const pendingReviewCount = 2;

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
