/**
 * Tipos del estado de la app y su estado inicial vacío. Los datos vienen del servidor
 * (cursos, documentos, consumo) o se generan en el uso real (conversaciones); no hay
 * datos de prueba.
 */
import type { Course, TopicDetail } from '@/data/mock';
import type { ErrorCode } from '@/i18n/es';
import type { Language } from '@/i18n/language';
import type { ContentItem } from './content';

export type Level = 'school' | 'university' | 'other';
export type Plan = 'free' | 'student';

export interface SessionUser {
  id: string;
  name: string;
  fullName: string;
  email: string;
  level: Level;
  /**
   * true si confirmó tener 18 años o más (`user_metadata.adult_confirmed`). Quien entra con
   * Google no pasó por el registro con fecha de nacimiento y debe confirmarlo antes de seguir.
   */
  adultConfirmed: boolean;
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

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

/** Tema detectado en el documento (lo genera el worker a partir de sus títulos). */
export interface DocTopic {
  id: string;
  parentId: string | null;
  title: string;
  /** Páginas donde aparece el tema o sus subtemas. */
  pages: number[];
  /** 1 = tema raíz. */
  depth: number;
}

export interface DocRecord {
  id: string;
  name: string;
  sizeMb: number;
  pages: number;
  /** '' si todavía no tiene curso. */
  courseId: string;
  path: string[];
  topics: string[];
  /** Índice de temas con páginas; `undefined` mientras no se haya cargado. */
  outline?: DocTopic[];
  uploadedLabel: string;
  status: DocumentStatus;
  topicCount: number;
  createdAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  page: number;
  klass: number;
  section: string;
  text: string;
  /** Contexto externo asociado (siempre con fuente). */
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
  /** Id del documento en el servidor, una vez registrado. */
  documentId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'mascot';
  text: string;
  kind: 'text' | 'answer' | 'notFound' | 'external' | 'error' | 'limit';
  sources?: { page: number; klass: number; documentId: string }[];
  external?: { title: string; host: string; url?: string };
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

export interface Usage {
  day: string;
  questions: number;
  questionsLimit: number;
  storageBytes: number;
  storageLimit: number;
}

export interface AppState {
  version: 3;
  session: SessionUser | null;
  /** Usuario al que pertenecen las conversaciones guardadas en el dispositivo. */
  ownerId: string | null;
  settings: Settings;
  plan: Plan;
  courses: StoreCourse[];
  topics: Record<string, TopicDetail>;
  documents: DocRecord[];
  /** Definiciones, conceptos y ejercicios por clase (llegan en la fase de estudio). */
  items: ContentItem[];
  chunks: Chunk[];
  uploads: UploadJob[];
  conversations: Conversation[];
  usage: Usage;
  /** Estado de la última carga desde el servidor. */
  sync: { loading: boolean; error: ErrorCode | null };
  /**
   * Aceptación de los Términos y la Política vigentes (`LEGAL_VERSION`) según el servidor:
   * 'unknown' mientras no se sabe (cargando o sin red), 'missing' si falta alguno.
   */
  consent: 'unknown' | 'accepted' | 'missing';
  /**
   * La cuenta puede abrir el panel de administración (lo decide `GET /v1/admin/me`). Nunca se
   * guarda en el dispositivo: se vuelve a preguntar en cada sesión.
   */
  isAdmin: boolean;
  /** true mientras se consulta `isAdmin` (el panel espera en vez de redirigir). */
  adminChecking: boolean;
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
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export const DEFAULT_SETTINGS: Settings = {
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
};

/** Plan gratis mientras no haya suscripciones (fase 4); el servidor manda los límites reales. */
export const DEFAULT_USAGE: Usage = {
  day: todayKey(),
  questions: 0,
  questionsLimit: 20,
  storageBytes: 0,
  storageLimit: 500 * 1024 * 1024,
};

export function createInitialState(): AppState {
  return {
    version: 3,
    session: null,
    ownerId: null,
    settings: DEFAULT_SETTINGS,
    plan: 'free',
    courses: [],
    topics: {},
    documents: [],
    items: [],
    chunks: [],
    uploads: [],
    conversations: [],
    usage: DEFAULT_USAGE,
    sync: { loading: false, error: null },
    consent: 'unknown',
    isAdmin: false,
    adminChecking: false,
    shares: [],
    waitlist: [],
    study: { known: [], unknown: [], lastQuiz: null, boxes: {} },
    payments: [],
    notices: { languages: false, reported: [] },
  };
}
