/**
 * Backend simulado de la app: estado en memoria, persistido en el dispositivo y
 * acciones con la misma semántica que tendrá la API real (validación con códigos
 * de error, ingesta asíncrona, respuestas citadas por página, cuotas).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { ErrorCode } from '@/i18n/es';
import { normalize, overlapScore } from '@/lib/text-search';
import { extensionOf, suggestCourse, validateUpload } from '@/lib/upload-rules';
import { isValidEmail, isWeakPassword } from '@/lib/validation';
import type { TopicDetail } from '@/data/mock';
import {
  createSeed,
  todayKey,
  type AppState,
  type Chunk,
  type Conversation,
  type Level,
  type Message,
  type Plan,
  type Settings,
  type StoreCourse,
  type UploadJob,
} from './seed';

export * from './seed';
export * from './content';

const STORAGE_KEY = 'apuntor:state:v2';
export const FREE_DAILY_QUESTIONS = 20;
export const QUOTA_MB: Record<Plan, number> = { free: 500, student: 5000 };
/** Similitud mínima para considerar que un fragmento responde la pregunta. */
export const MIN_ANSWER_SCORE = 0.34;

let state: AppState = createSeed();
const listeners = new Set<() => void>();
let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function getState(): AppState {
  return state;
}

function setState(update: (s: AppState) => AppState): void {
  state = update(state);
  listeners.forEach((l) => l());
  void persist();
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento (ventana privada, vista previa aislada): la app sigue en memoria.
  }
}

/** Carga el estado guardado; si no hay o es de otra versión, usa los datos de prueba. */
export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed.version === 2) state = { ...createSeed(), ...parsed } as AppState;
    }
  } catch {
    state = createSeed();
  }
  listeners.forEach((l) => l());
}

/** Restablece los datos de prueba (útil para volver a recorrer los flujos). */
export function resetDemo(): void {
  setState(() => createSeed());
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(state),
  );
}

// --- Selectores ------------------------------------------------------------------

export function usedMb(s: AppState): number {
  return Math.round((s.baseUsedMb + s.documents.reduce((acc, d) => acc + d.sizeMb, 0)) * 10) / 10;
}

export function quotaMb(s: AppState): number {
  return QUOTA_MB[s.plan];
}

export function questionsToday(s: AppState): number {
  return s.usage.day === todayKey() ? s.usage.questions : 0;
}

export function limitReached(s: AppState): boolean {
  return s.plan === 'free' && questionsToday(s) >= FREE_DAILY_QUESTIONS;
}

export function pendingReview(s: AppState): UploadJob[] {
  return s.uploads.filter((u) => u.status === 'review');
}

// --- Sesión ----------------------------------------------------------------------

export type AuthResult =
  { ok: true } | { ok: false; error: ErrorCode; field: 'email' | 'password' };

export function signIn(email: string, password: string): AuthResult {
  const account = state.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
  if (!account || account.password !== password)
    return { ok: false, error: 'AUTH_INVALID', field: 'password' };
  const first = account.fullName.split(' ')[0] ?? account.fullName;
  setState((s) => ({
    ...s,
    session: {
      name: first,
      fullName: account.fullName,
      email: account.email,
      level: s.session?.level ?? 'university',
    },
  }));
  return { ok: true };
}

export function signUp(fullName: string, email: string, password: string): AuthResult {
  if (!isValidEmail(email)) return { ok: false, error: 'AUTH_INVALID', field: 'email' };
  if (state.accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase()))
    return { ok: false, error: 'AUTH_EMAIL_TAKEN', field: 'email' };
  if (isWeakPassword(password))
    return { ok: false, error: 'AUTH_WEAK_PASSWORD', field: 'password' };
  const name = fullName.trim() || email.split('@')[0] || 'Estudiante';
  setState((s) => ({
    ...s,
    accounts: [...s.accounts, { email: email.trim(), password, fullName: name }],
    session: {
      name: name.split(' ')[0] ?? name,
      fullName: name,
      email: email.trim(),
      level: 'university',
    },
  }));
  return { ok: true };
}

/** Inicio con Google/Apple simulado: entra con la cuenta de prueba. */
export function signInWithProvider(): void {
  const demo = state.accounts[0];
  if (demo) signIn(demo.email, demo.password);
}

export function signOut(): void {
  setState((s) => ({ ...s, session: null }));
}

export function setLevel(level: Level): void {
  setState((s) => (s.session ? { ...s, session: { ...s.session, level } } : s));
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Borra la cuenta y todos sus datos de inmediato (pantalla 40). */
export function deleteAccount(): void {
  const email = state.session?.email;
  setState((s) => ({ ...createSeed(), accounts: s.accounts.filter((a) => a.email !== email) }));
}

export function joinWaitlist(email: string): void {
  setState((s) => ({ ...s, waitlist: [...new Set([...s.waitlist, email.trim()])] }));
}

// --- Documentos ------------------------------------------------------------------

export function deleteDocument(id: string): void {
  setState((s) => ({
    ...s,
    documents: s.documents.filter((d) => d.id !== id),
    chunks: s.chunks.filter((c) => c.documentId !== id),
  }));
}

export function renameDocument(id: string, name: string): void {
  setState((s) => ({
    ...s,
    documents: s.documents.map((d) => (d.id === id ? { ...d, name } : d)),
  }));
}

// --- Subida (ingesta simulada, nunca bloquea la interfaz) -------------------------

export interface PickedFile {
  name: string;
  sizeMb: number;
}

/** Registra los archivos: los inválidos quedan como fallidos con su código; los válidos empiezan a subir. */
export function enqueueUploads(files: readonly PickedFile[]): UploadJob[] {
  let used = usedMb(state);
  const quota = quotaMb(state);
  const jobs: UploadJob[] = files.map((f) => {
    const error = validateUpload(f, used, quota);
    if (!error) used += f.sizeMb;
    return {
      id: newId('up'),
      name: f.name,
      sizeMb: f.sizeMb,
      status: error ? 'failed' : 'uploading',
      progress: 0,
      ...(error ? { error } : {}),
      path: [],
      confident: false,
    };
  });
  setState((s) => ({ ...s, uploads: [...s.uploads.filter((u) => u.status !== 'done'), ...jobs] }));
  startTicker();
  return jobs;
}

let ticker: ReturnType<typeof setInterval> | null = null;

function startTicker(): void {
  if (ticker) return;
  ticker = setInterval(tickUploads, 400);
}

/** Avanza la subida y el procesamiento; al terminar, clasifica (con o sin confianza). */
export function tickUploads(): void {
  const active = state.uploads.some((u) => u.status === 'uploading' || u.status === 'processing');
  if (!active) {
    if (ticker) clearInterval(ticker);
    ticker = null;
    return;
  }
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) => {
      if (u.status === 'uploading') {
        const progress = Math.min(1, u.progress + Math.max(0.08, 2 / Math.max(u.sizeMb, 1) / 10));
        return progress >= 1 ? { ...u, status: 'processing', progress: 0 } : { ...u, progress };
      }
      if (u.status === 'processing') {
        const progress = Math.min(1, u.progress + 0.2);
        if (progress < 1) return { ...u, progress };
        const course = suggestCourse(u.name, s.courses);
        const firstClass = course?.classes.find((k) => k.progress < 1) ?? course?.classes[0];
        const klass = firstClass?.title.split(' · ')[0] ?? 'Clase 1';
        return course
          ? {
              ...u,
              status: 'review',
              progress: 1,
              courseId: course.id,
              path: [course.title, klass, 'Teoría'],
              confident: true,
            }
          : { ...u, status: 'review', progress: 1, path: [], confident: false };
      }
      return u;
    }),
  }));
}

export function retryUpload(id: string): void {
  const job = state.uploads.find((u) => u.id === id);
  if (!job) return;
  const error = validateUpload(job, usedMb(state), quotaMb(state));
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) =>
      u.id === id
        ? error
          ? { ...u, error }
          : {
              id: u.id,
              name: u.name,
              sizeMb: u.sizeMb,
              status: 'uploading',
              progress: 0,
              path: [],
              confident: false,
            }
        : u,
    ),
  }));
  startTicker();
}

export function removeUpload(id: string): void {
  setState((s) => ({ ...s, uploads: s.uploads.filter((u) => u.id !== id) }));
}

export function assignUploadCourse(id: string, courseId: string): void {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return;
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) =>
      u.id === id
        ? { ...u, courseId, path: [course.title, 'Clase 1', 'Teoría'], confident: true }
        : u,
    ),
  }));
}

export function createCourse(title: string): string {
  const id = newId('curso');
  setState((s) => ({
    ...s,
    courses: [
      ...s.courses,
      {
        id,
        title,
        icon: 'book',
        tone: 'neutral',
        keywords: [],
        classes: [
          {
            id: newId('clase'),
            title: 'Clase 1 · General',
            topicCount: 0,
            progress: 0,
            sections: [],
          },
        ],
        topicCount: 0,
        documentCount: 0,
        progress: 0,
      },
    ],
  }));
  return id;
}

/** Guarda en sus cursos los archivos confirmados: crean documento y fragmentos citables. */
export function confirmUploads(): number {
  const ready = state.uploads.filter((u) => u.status === 'review' && u.courseId);
  setState((s) => ({
    ...s,
    documents: [
      ...ready.map((u) => ({
        id: u.id,
        name: u.name,
        sizeMb: u.sizeMb,
        pages: Math.max(1, Math.round(u.sizeMb * 6)),
        courseId: u.courseId ?? '',
        path: u.path,
        topics: [u.path.at(-1) ?? 'General'],
        uploadedLabel: 'hoy',
      })),
      ...s.documents,
    ],
    chunks: [
      ...s.chunks,
      ...ready.map<Chunk>((u) => ({
        id: newId('k'),
        documentId: u.id,
        page: 1,
        klass: 1,
        section: u.path.at(-1) ?? 'General',
        text: `Contenido de ${u.name.replace(/\.[^.]+$/u, '')}.`,
      })),
    ],
    courses: s.courses.map((c) => {
      const added = ready.filter((u) => u.courseId === c.id).length;
      return added ? { ...c, documentCount: c.documentCount + added } : c;
    }),
    uploads: s.uploads.map((u) => (ready.includes(u) ? { ...u, status: 'done' } : u)),
  }));
  return ready.length;
}

export function uploadSummary(s: AppState): {
  active: UploadJob[];
  failed: UploadJob[];
  review: UploadJob[];
  done: number;
  total: number;
} {
  const current = s.uploads.filter((u) => u.status !== 'done');
  return {
    active: current.filter((u) => u.status === 'uploading' || u.status === 'processing'),
    failed: current.filter((u) => u.status === 'failed'),
    review: current.filter((u) => u.status === 'review'),
    done: current.filter((u) => u.status === 'review').length,
    total: current.length,
  };
}

// --- Chat (RAG simulado: solo responde con fragmentos propios y cita la página) ----

export type AnswerResult = { kind: 'answer'; chunk: Chunk; score: number } | { kind: 'notFound' };

export function findAnswer(question: string, s: AppState = state): AnswerResult {
  if (!s.settings.useDocs) return { kind: 'notFound' };
  let best: { chunk: Chunk; score: number } | null = null;
  for (const chunk of s.chunks) {
    const score = overlapScore(question, `${chunk.section} ${chunk.text}`);
    if (!best || score > best.score) best = { chunk, score };
  }
  return best && best.score >= MIN_ANSWER_SCORE
    ? { kind: 'answer', ...best }
    : { kind: 'notFound' };
}

function courseOfChunk(s: AppState, chunk: Chunk): string {
  const doc = s.documents.find((d) => d.id === chunk.documentId);
  return s.courses.find((c) => c.id === doc?.courseId)?.title ?? '';
}

export function startConversation(): string {
  const id = newId('conv');
  setState((s) => ({
    ...s,
    conversations: [
      { id, title: '', course: '', updatedAt: Date.now(), messages: [] },
      ...s.conversations,
    ],
  }));
  return id;
}

function appendMessages(
  conversationId: string,
  messages: Message[],
  patch: Partial<Conversation> = {},
): void {
  setState((s) => ({
    ...s,
    conversations: s.conversations.map((c) =>
      c.id === conversationId
        ? { ...c, ...patch, messages: [...c.messages, ...messages], updatedAt: Date.now() }
        : c,
    ),
  }));
}

/** Envía una pregunta. Devuelve false si se alcanzó el límite diario (no se cuenta). */
export function askQuestion(conversationId: string, question: string): boolean {
  const text = question.trim();
  if (!text) return false;
  const conv = state.conversations.find((c) => c.id === conversationId);
  const userMsg: Message = { id: newId('m'), role: 'user', kind: 'text', text };
  if (limitReached(state)) {
    appendMessages(conversationId, [
      userMsg,
      { id: newId('m'), role: 'mascot', kind: 'limit', text: '' },
    ]);
    return false;
  }
  appendMessages(
    conversationId,
    [userMsg],
    conv?.title ? {} : { title: text.length > 40 ? `${text.slice(0, 40)}…` : text },
  );
  setState((s) => ({ ...s, usage: { day: todayKey(), questions: questionsToday(s) + 1 } }));
  return true;
}

/** Genera la respuesta de la mascota (se llama tras el estado "respondiendo"). */
export function answerQuestion(conversationId: string, question: string): void {
  const result = findAnswer(question);
  if (result.kind === 'notFound') {
    appendMessages(conversationId, [
      { id: newId('m'), role: 'mascot', kind: 'notFound', text: '' },
    ]);
    return;
  }
  const { chunk } = result;
  const external =
    state.settings.external && chunk.external
      ? { title: chunk.external.title, host: chunk.external.host }
      : undefined;
  appendMessages(
    conversationId,
    [
      {
        id: newId('m'),
        role: 'mascot',
        kind: 'answer',
        text: `Según tus apuntes (Clase ${chunk.klass}, p. ${chunk.page}): ${chunk.text}`,
        sources: [{ page: chunk.page, klass: chunk.klass, documentId: chunk.documentId }],
        ...(external ? { external } : {}),
      },
    ],
    { course: courseOfChunk(state, chunk) },
  );
}

const EXTERNAL_KB: { keywords: string[]; text: string; title: string; host: string }[] = [
  {
    keywords: ['calculo', 'desarrollo', 'invento', 'newton', 'leibniz'],
    text: 'Newton y Leibniz lo desarrollaron de forma independiente en el siglo XVII.',
    title: 'Historia del cálculo',
    host: 'es.wikipedia.org',
  },
  {
    keywords: ['penicilina', 'fleming'],
    text: 'Alexander Fleming descubrió la penicilina en 1928.',
    title: 'Penicilina',
    host: 'es.wikipedia.org',
  },
  {
    keywords: ['machu', 'picchu'],
    text: 'Machu Picchu fue construida en el siglo XV durante el gobierno de Pachacútec.',
    title: 'Machu Picchu',
    host: 'es.wikipedia.org',
  },
];

/** "Buscar fuera" (pantalla 30): respuesta externa aparte, siempre con fuente. */
export function searchOutside(conversationId: string, question: string): void {
  const hit = EXTERNAL_KB.map((e) => ({
    e,
    score: overlapScore(e.keywords.join(' '), question),
  })).sort((a, b) => b.score - a.score)[0];
  const msg: Message =
    hit && hit.score > 0
      ? {
          id: newId('m'),
          role: 'mascot',
          kind: 'external',
          text: hit.e.text,
          external: { title: hit.e.title, host: hit.e.host },
        }
      : {
          id: newId('m'),
          role: 'mascot',
          kind: 'external',
          text: 'No encontré una fuente externa confiable para esto.',
        };
  appendMessages(conversationId, [msg]);
}

// --- Estudio -----------------------------------------------------------------------

export function recordQuiz(score: number, total: number): void {
  setState((s) => ({ ...s, study: { ...s.study, lastQuiz: { score, total } } }));
}

export function gradeCard(cardId: string, known: boolean): void {
  setState((s) => ({
    ...s,
    study: {
      ...s.study,
      known: known
        ? [...new Set([...s.study.known, cardId])]
        : s.study.known.filter((k) => k !== cardId),
      unknown: known
        ? s.study.unknown.filter((k) => k !== cardId)
        : [...new Set([...s.study.unknown, cardId])],
    },
  }));
}

// --- Planes y compartir ----------------------------------------------------------

export function choosePlan(plan: Plan): void {
  setState((s) => ({
    ...s,
    plan,
    payments:
      plan === 'student' && s.plan !== 'student'
        ? [
            {
              id: newId('pay'),
              date: new Date().toLocaleDateString('es-PE'),
              amount: 'S/ 14',
              plan: 'Estudiante',
            },
            ...s.payments,
          ]
        : s.payments,
  }));
}

export function createShare(topicId: string, expiresLabel: string): string {
  const token = Math.random().toString(36).slice(2, 7);
  setState((s) => ({
    ...s,
    shares: [{ token, topicId, expiresLabel, active: true }, ...s.shares],
  }));
  return token;
}

export function stopSharing(token: string): void {
  setState((s) => ({
    ...s,
    shares: s.shares.map((sh) => (sh.token === token ? { ...sh, active: false } : sh)),
  }));
}

export function fileFromPicker(asset: { name: string; size?: number | null }): PickedFile {
  return { name: asset.name, sizeMb: Math.round(((asset.size ?? 0) / (1024 * 1024)) * 10) / 10 };
}

export { extensionOf };

// --- Búsqueda (pantalla 39): títulos y contenido de documentos, y chats ----------

export interface SearchHit {
  id: string;
  kind: 'document' | 'chat';
  targetId: string;
  title: string;
  location: string;
  snippet: string;
  tag: string;
}

function snippetAround(text: string, query: string): string {
  const i = normalize(text).indexOf(normalize(query));
  if (i < 0) return text.length > 110 ? `${text.slice(0, 110)}…` : text;
  const start = Math.max(0, i - 30);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 110)}${start + 110 < text.length ? '…' : ''}`;
}

function matches(query: string, text: string): boolean {
  const q = normalize(query.trim());
  return q.length > 0 && (normalize(text).includes(q) || overlapScore(query, text) >= 0.6);
}

export function searchAll(query: string, s: AppState = state): SearchHit[] {
  if (query.trim().length === 0) return [];
  const hits: SearchHit[] = [];
  for (const doc of s.documents) {
    const course = s.courses.find((c) => c.id === doc.courseId)?.title ?? '';
    const tag = doc.path.slice(0, 2).join(' › ') || course;
    const chunk = s.chunks
      .filter((c) => c.documentId === doc.id)
      .find((c) => matches(query, `${c.section} ${c.text}`));
    if (chunk)
      hits.push({
        id: `${doc.id}-${chunk.id}`,
        kind: 'document',
        targetId: doc.id,
        title: doc.name,
        location: `Página ${chunk.page}`,
        snippet: snippetAround(chunk.text, query),
        tag,
      });
    else if (matches(query, doc.name))
      hits.push({
        id: doc.id,
        kind: 'document',
        targetId: doc.id,
        title: doc.name,
        location: `${doc.pages} páginas`,
        snippet: doc.topics.join(' · '),
        tag,
      });
  }
  for (const conv of s.conversations) {
    const msg = conv.messages.find((m) => matches(query, m.text));
    if (msg || matches(query, conv.title)) {
      hits.push({
        id: conv.id,
        kind: 'chat',
        targetId: conv.id,
        title: `Chat · ${conv.title}`,
        location: new Date(conv.updatedAt).toLocaleDateString('es-PE'),
        snippet: snippetAround(msg?.text ?? conv.title, query),
        tag: conv.course || 'Chat',
      });
    }
  }
  return hits;
}

// --- Perfil y ajustes ----------------------------------------------------------------

/** Actualiza nombre y correo. El nivel ("Qué estudias") solo se elige al registrarse. */
export function updateProfile(patch: { fullName: string; email: string }): AuthResult {
  const email = patch.email.trim();
  if (!isValidEmail(email)) return { ok: false, error: 'AUTH_INVALID', field: 'email' };
  const current = state.session?.email ?? '';
  if (
    email.toLowerCase() !== current.toLowerCase() &&
    state.accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())
  ) {
    return { ok: false, error: 'AUTH_EMAIL_TAKEN', field: 'email' };
  }
  const fullName = patch.fullName.trim() || state.session?.fullName || 'Estudiante';
  setState((s) => ({
    ...s,
    accounts: s.accounts.map((a) => (a.email === current ? { ...a, email, fullName } : a)),
    session: {
      name: fullName.split(' ')[0] ?? fullName,
      fullName,
      email,
      level: s.session?.level ?? 'university',
    },
  }));
  return { ok: true };
}

/** Cambia la contraseña: exige la actual, la nueva dos veces (iguales) y al menos 8 caracteres. */
export function changePassword(currentPassword: string, next: string, confirm: string): AuthResult {
  const account = state.accounts.find((a) => a.email === state.session?.email);
  if (!account || account.password !== currentPassword)
    return { ok: false, error: 'AUTH_INVALID', field: 'password' };
  if (isWeakPassword(next)) return { ok: false, error: 'AUTH_WEAK_PASSWORD', field: 'password' };
  if (next !== confirm) return { ok: false, error: 'AUTH_PASSWORD_MISMATCH', field: 'password' };
  setState((s) => ({
    ...s,
    accounts: s.accounts.map((a) => (a.email === account.email ? { ...a, password: next } : a)),
  }));
  return { ok: true };
}

export function moveDocument(id: string, courseId: string): void {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return;
  setState((s) => ({
    ...s,
    documents: s.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            courseId,
            path: [
              course.title,
              course.classes[0]?.title.split(' · ')[0] ?? 'Clase 1',
              d.path.at(-1) ?? 'General',
            ],
          }
        : d,
    ),
  }));
}

export function setReviewTime(time: string): void {
  updateSettings({ reviewTime: time });
}

export function notifyMoreLanguages(): void {
  setState((s) => ({ ...s, notices: { ...s.notices, languages: true } }));
}

export function reportContent(token: string): void {
  setState((s) => ({
    ...s,
    notices: { ...s.notices, reported: [...new Set([...s.notices.reported, token])] },
  }));
}

/** Exporta los datos del usuario (documentos, cursos, chats) como JSON legible. */
export function exportUserData(s: AppState = state): string {
  return JSON.stringify(
    {
      usuario: s.session,
      ajustes: s.settings,
      plan: s.plan,
      cursos: s.courses.map((c) => c.title),
      documentos: s.documents.map((d) => ({ nombre: d.name, curso: d.path[0], paginas: d.pages })),
      conversaciones: s.conversations.map((c) => ({
        titulo: c.title,
        mensajes: c.messages.length,
      })),
    },
    null,
    2,
  );
}

// --- Contenido por clase y temas ----------------------------------------------------

export function classOf(
  s: AppState,
  classId: string,
): { course: StoreCourse; klass: StoreCourse['classes'][number] } | null {
  for (const course of s.courses) {
    const klass = course.classes.find((k) => k.id === classId);
    if (klass) return { course, klass };
  }
  return null;
}

/** Detalle de tema: el curado (si existe) o uno construido desde el contenido de la clase. */
export function topicDetail(s: AppState, topicId: string): TopicDetail | null {
  const curated = s.topics[topicId];
  if (curated) return curated;
  const item = s.items.find((i) => i.id === topicId);
  if (!item) return null;
  const found = classOf(s, item.classId);
  const doc = s.documents.find((d) => d.id === item.documentId);
  return {
    id: item.id,
    courseId: item.courseId,
    breadcrumb: [
      found?.course.title ?? '',
      `Clase ${item.klass}`,
      item.kind === 'ejercicio' ? 'Ejercicios' : 'Teoría',
    ],
    title: item.title,
    own: {
      source: `${doc?.name.replace(/\.[^.]+$/u, '') ?? 'Tus apuntes'} · p. ${item.page}`,
      text: item.text,
    },
    external: item.external ? { source: item.external.host, text: item.external.text } : null,
    notes: [],
  };
}
