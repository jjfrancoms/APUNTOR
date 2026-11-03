/**
 * Datos de prueba con los que arranca la app (y a los que vuelve con "Restablecer datos").
 * Simulan lo que devolverá el backend: documentos con fragmentos por página, cursos,
 * conversaciones y uso. Cuenta de prueba: ana@correo.com / apuntor123.
 */
import {
  courses as baseCourses,
  topics as baseTopics,
  type Course,
  type TopicDetail,
} from '@/data/mock';
import type { ErrorCode } from '@/i18n/es';
import type { Language } from '@/i18n/language';
import { chunksFromContent, contentItems, extraDocuments, type ContentItem } from './content';

export const DEMO_EMAIL = 'ana@correo.com';
export const DEMO_PASSWORD = 'apuntor123';

export type Level = 'school' | 'university' | 'other';
export type Plan = 'free' | 'student';

export interface Account {
  email: string;
  password: string;
  fullName: string;
}

export interface SessionUser {
  name: string;
  fullName: string;
  email: string;
  level: Level;
}

/** Apariencia: 'system' sigue el modo claro/oscuro del dispositivo. */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  language: Language;
  useDocs: boolean;
  external: boolean;
  analytics: boolean;
  saveProgress: boolean;
  lightMode: boolean;
  voice: boolean;
  notifProcessed: boolean;
  notifReview: boolean;
  notifLimit: boolean;
  reviewTime: string;
}

export interface StoreCourse extends Course {
  /** Palabras que ayudan a clasificar archivos nuevos en este curso. */
  keywords: string[];
}

export interface DocRecord {
  id: string;
  name: string;
  sizeMb: number;
  pages: number;
  courseId: string;
  path: string[];
  topics: string[];
  uploadedLabel: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  page: number;
  klass: number;
  section: string;
  text: string;
  /** Contexto externo de ejemplo asociado (siempre con fuente). */
  external?: { title: string; host: string; text: string };
}

export type UploadStatus = 'uploading' | 'processing' | 'review' | 'failed' | 'done';

export interface UploadJob {
  id: string;
  name: string;
  sizeMb: number;
  status: UploadStatus;
  /** 0–1 */
  progress: number;
  error?: ErrorCode;
  courseId?: string;
  path: string[];
  confident: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'mascot';
  text: string;
  kind: 'text' | 'answer' | 'notFound' | 'external' | 'error' | 'limit';
  sources?: { page: number; klass: number; documentId: string }[];
  external?: { title: string; host: string };
}

export interface Conversation {
  id: string;
  title: string;
  course: string;
  updatedAt: number;
  messages: Message[];
}

export interface ShareLink {
  token: string;
  topicId: string;
  expiresLabel: string;
  active: boolean;
}

export interface AppState {
  version: 2;
  accounts: Account[];
  session: SessionUser | null;
  settings: Settings;
  plan: Plan;
  courses: StoreCourse[];
  topics: Record<string, TopicDetail>;
  documents: DocRecord[];
  /** Definiciones, conceptos y ejercicios por clase, con página de origen. */
  items: ContentItem[];
  chunks: Chunk[];
  uploads: UploadJob[];
  conversations: Conversation[];
  usage: { day: string; questions: number };
  shares: ShareLink[];
  waitlist: string[];
  study: {
    known: string[];
    unknown: string[];
    lastQuiz: { score: number; total: number } | null;
    /** Caja de repetición espaciada y próxima fecha (AAAA-MM-DD) de cada tarjeta. */
    boxes?: Record<string, { box: number; due: string }>;
  };
  payments: { id: string; date: string; amount: string; plan: string }[];
  notices: { languages: boolean; reported: string[] };
  /** Espacio ocupado por archivos que no son documentos de estudio (MB). */
  baseUsedMb: number;
}

const KEYWORDS: Record<string, string[]> = {
  'calculo-1': ['calculo', 'limite', 'limites', 'derivada', 'continuidad', 'funcion'],
  'fisica-2': ['fisica', 'dinamica', 'electro', 'ondas', 'newton'],
  'historia-peru': ['historia', 'peru', 'inca', 'preinca', 'virreinato'],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function createSeed(): AppState {
  return {
    version: 2,
    accounts: [{ email: DEMO_EMAIL, password: DEMO_PASSWORD, fullName: 'Ana Torres' }],
    session: null,
    settings: {
      useDocs: true,
      external: true,
      analytics: false,
      saveProgress: true,
      theme: 'system',
      language: 'es',
      lightMode: false,
      voice: false,
      notifProcessed: true,
      notifReview: true,
      notifLimit: false,
      reviewTime: '8:00 p. m.',
    },
    plan: 'free',
    courses: baseCourses.map((c) => ({
      ...c,
      keywords: KEYWORDS[c.id] ?? [],
      topicCount: contentItems.filter((i) => i.courseId === c.id).length,
      classes: c.classes.map((k) => ({
        ...k,
        topicCount: contentItems.filter((i) => i.classId === k.id).length,
      })),
    })),
    topics: { ...baseTopics },
    documents: [
      {
        id: 'limites-continuidad',
        name: 'Límites y continuidad.pdf',
        sizeMb: 2.4,
        pages: 34,
        courseId: 'calculo-1',
        path: ['Cálculo I', 'Clase 3', 'Límites'],
        topics: ['Definición de límite', 'Límites laterales', 'Continuidad'],
        uploadedLabel: 'hoy',
      },
      {
        id: 'calculo-problemas',
        name: 'Cálculo – problemas.pdf',
        sizeMb: 1.1,
        pages: 12,
        courseId: 'calculo-1',
        path: ['Cálculo I', 'Clase 3', 'Ejercicios'],
        topics: ['Práctica guiada 3'],
        uploadedLabel: 'ayer',
      },
      {
        id: 'fisica-dinamica',
        name: 'Física II – dinámica.pptx',
        sizeMb: 8.1,
        pages: 22,
        courseId: 'fisica-2',
        path: ['Física II', 'Clase 2', 'Dinámica'],
        topics: ['Leyes de Newton'],
        uploadedLabel: 'lunes',
      },
      {
        id: 'historia-preincas',
        name: 'Culturas preincas.docx',
        sizeMb: 1.2,
        pages: 9,
        courseId: 'historia-peru',
        path: ['Historia del Perú', 'Clase 1', 'Culturas preincas'],
        topics: ['Chavín', 'Paracas', 'Moche'],
        uploadedLabel: 'la semana pasada',
      },
      ...extraDocuments,
    ],
    items: contentItems,
    chunks: chunksFromContent(contentItems),
    uploads: [
      {
        id: 'up-r3',
        name: 'apuntes-clase.docx',
        sizeMb: 0.8,
        status: 'review',
        progress: 1,
        path: [],
        confident: false,
      },
      {
        id: 'up-r4',
        name: 'Resumen dinámica.pdf',
        sizeMb: 0.6,
        status: 'review',
        progress: 1,
        courseId: 'fisica-2',
        path: ['Física II', 'Clase 2', 'Dinámica'],
        confident: true,
      },
    ],
    conversations: [
      {
        id: 'c1',
        title: 'Límite con épsilon y delta',
        course: 'Cálculo I',
        updatedAt: now - 2 * 60 * 60 * 1000,
        messages: [
          {
            id: 'm1',
            role: 'user',
            kind: 'text',
            text: 'No entiendo la definición de límite con épsilon y delta',
          },
          {
            id: 'm2',
            role: 'mascot',
            kind: 'answer',
            text: 'Te lo explico con tus apuntes (Clase 3, p. 12): imagina que alguien te reta a acercarte a L tanto como quieras. Épsilon dice qué tan cerca; delta dice qué tan cerca de a debes estar para lograrlo.',
            sources: [{ page: 12, klass: 3, documentId: 'limites-continuidad' }],
            external: { title: 'Límite de una función', host: 'es.wikipedia.org' },
          },
        ],
      },
      {
        id: 'c2',
        title: 'Quiz de dinámica',
        course: 'Física II',
        updatedAt: now - 4 * 60 * 60 * 1000,
        messages: [
          { id: 'm3', role: 'user', kind: 'text', text: '¿Qué dice la tercera ley de Newton?' },
          {
            id: 'm4',
            role: 'mascot',
            kind: 'answer',
            text: 'Según tus apuntes (Clase 2, p. 5): a toda acción corresponde una reacción igual y opuesta.',
            sources: [{ page: 5, klass: 2, documentId: 'fisica-dinamica' }],
          },
        ],
      },
      {
        id: 'c3',
        title: 'Resumen de las culturas preincas',
        course: 'Historia del Perú',
        updatedAt: now - 3 * DAY_MS,
        messages: [
          { id: 'm5', role: 'user', kind: 'text', text: '¿Dónde estaba el centro de Chavín?' },
          {
            id: 'm6',
            role: 'mascot',
            kind: 'answer',
            text: 'Según tus apuntes (Clase 1, p. 2): su centro ceremonial principal fue Chavín de Huántar.',
            sources: [{ page: 2, klass: 1, documentId: 'historia-preincas' }],
          },
        ],
      },
    ],
    usage: { day: todayKey(), questions: 7 },
    shares: [],
    payments: [],
    notices: { languages: false, reported: [] },
    waitlist: [],
    study: { known: [], unknown: [], lastQuiz: null },
    baseUsedMb: 120,
  };
}
