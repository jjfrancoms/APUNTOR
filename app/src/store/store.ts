/**
 * Estado de la app conectado al servidor. Cuentas con Supabase Auth; cursos, documentos,
 * subidas, preguntas y consumo con la API de APUNTOR. En el dispositivo solo se guardan los
 * ajustes, las conversaciones y el progreso de estudio del usuario que inició sesión.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import type { TopicDetail } from '@/data/mock';
import type { ErrorCode } from '@/i18n/es';
import { api, ApiRequestError, toErrorCode, type ApiDocument, type ApiUsage } from '@/lib/api';
import { backendConfigured } from '@/lib/config';
import { daysUntilNext, nextBox } from '@/lib/flashcards';
import { supabase } from '@/lib/supabase';
import { normalize, overlapScore } from '@/lib/text-search';
import { putFile } from '@/lib/upload-transfer';
import { extensionOf, validateUpload } from '@/lib/upload-rules';
import { ADULT_AGE, ageOn, isValidEmail, isWeakPassword, parseBirthDate } from '@/lib/validation';
import {
  createInitialState,
  DEFAULT_SETTINGS,
  DEFAULT_USAGE,
  todayKey,
  type AppState,
  type Conversation,
  type DocRecord,
  type Level,
  type Message,
  type Plan,
  type SessionUser,
  type Settings,
  type StoreCourse,
  type UploadJob,
} from './seed';

export * from './seed';
export * from './content';

const STORAGE_KEY = 'apuntor:state:v3';
const MB = 1024 * 1024;
/** Cada cuánto se consulta el estado de un documento mientras el worker lo procesa. */
const POLL_MS = 3000;
const POLL_LIMIT_MS = 15 * 60 * 1000;

let state: AppState = createInitialState();
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

/** Solo lo que pertenece al dispositivo: el resto vuelve a pedirse al servidor. */
interface Persisted {
  version: 3;
  ownerId: string | null;
  settings: Settings;
  conversations: Conversation[];
  study: AppState['study'];
}

async function persist(): Promise<void> {
  const data: Persisted = {
    version: 3,
    ownerId: state.ownerId,
    settings: state.settings,
    conversations: state.conversations,
    study: state.study,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Sin almacenamiento (ventana privada): la app sigue en memoria.
  }
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
  return Math.round((s.usage.storageBytes / MB) * 10) / 10;
}

export function quotaMb(s: AppState): number {
  return Math.round(s.usage.storageLimit / MB);
}

export function questionsToday(s: AppState): number {
  return s.usage.day === todayKey() ? s.usage.questions : 0;
}

export function dailyQuestionLimit(s: AppState): number {
  return s.usage.questionsLimit;
}

export function limitReached(s: AppState): boolean {
  return s.plan === 'free' && questionsToday(s) >= s.usage.questionsLimit;
}

export function pendingReview(s: AppState): UploadJob[] {
  return s.uploads.filter((u) => u.status === 'review');
}

// --- Carga desde el servidor -----------------------------------------------------

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/u, '');
}

function uploadedLabel(iso: string): string {
  const date = new Date(iso);
  return todayKey(date) === todayKey() ? 'hoy' : date.toLocaleDateString('es-PE');
}

/** Documentos del servidor con la forma que usan las pantallas. */
export function toDocRecord(doc: ApiDocument, courseTitle: string | undefined): DocRecord {
  return {
    id: doc.id,
    name: doc.title,
    sizeMb: Math.round((doc.sizeBytes / MB) * 10) / 10,
    pages: doc.totalPages ?? 0,
    courseId: doc.courseId ?? '',
    path: courseTitle ? [courseTitle, stripExtension(doc.title)] : [],
    topics: [],
    uploadedLabel: uploadedLabel(doc.createdAt),
    status: doc.status,
    topicCount: doc.topicCount,
    createdAt: doc.createdAt,
  };
}

/** Cada curso agrupa sus documentos; cada documento hace de clase hasta la fase 2. */
export function buildCourses(
  courses: readonly { id: string; title: string }[],
  documents: readonly DocRecord[],
): StoreCourse[] {
  return courses.map((course) => {
    const classes = documents
      .filter((d) => d.courseId === course.id)
      .map((d) => ({
        id: d.id,
        title: stripExtension(d.name),
        topicCount: d.topicCount,
        progress: 0,
        sections: [],
      }));
    return {
      id: course.id,
      title: course.title,
      icon: 'book' as const,
      tone: 'neutral' as const,
      keywords: [],
      classes,
      topicCount: classes.reduce((sum, k) => sum + k.topicCount, 0),
      documentCount: classes.length,
      progress: 0,
    };
  });
}

function applyUsage(usage: ApiUsage): void {
  setState((s) => ({
    ...s,
    usage: {
      day: todayKey(),
      questions: usage.questionsToday,
      questionsLimit: usage.questionsLimit,
      storageBytes: usage.storageBytes,
      storageLimit: usage.storageLimit,
    },
  }));
}

export async function refreshUsage(): Promise<void> {
  try {
    applyUsage(await api.usage());
  } catch {
    // El consumo se vuelve a pedir en la próxima acción; no bloquea la pantalla.
  }
}

/** Cursos, documentos y consumo del usuario. */
export async function refreshAll(): Promise<void> {
  if (!state.session) return;
  setState((s) => ({ ...s, sync: { loading: true, error: null } }));
  try {
    const [{ courses }, { documents }, usage] = await Promise.all([
      api.courses(),
      api.documents(),
      api.usage(),
    ]);
    const titles = new Map(courses.map((c) => [c.id, c.title]));
    const docs = documents.map((d) =>
      toDocRecord(d, d.courseId ? titles.get(d.courseId) : undefined),
    );
    setState((s) => ({
      ...s,
      documents: docs,
      courses: buildCourses(courses, docs),
      sync: { loading: false, error: null },
    }));
    applyUsage(usage);
  } catch (error) {
    setState((s) => ({
      ...s,
      sync: { loading: false, error: toErrorCode(error, 'NET_UNAVAILABLE') },
    }));
  }
}

// --- Sesión ----------------------------------------------------------------------

export type AuthField = 'email' | 'password' | 'confirm' | 'birthDate';
export type AuthResult =
  { ok: true; needsConfirmation?: boolean } | { ok: false; error: ErrorCode; field: AuthField };

function isLevel(value: unknown): value is Level {
  return value === 'school' || value === 'university' || value === 'other';
}

function toSessionUser(user: User): SessionUser {
  const meta: Record<string, unknown> = user.user_metadata;
  const email = user.email ?? '';
  const fullName =
    typeof meta.full_name === 'string' && meta.full_name.length > 0
      ? meta.full_name
      : (email.split('@')[0] ?? '');
  return {
    id: user.id,
    name: fullName.split(' ')[0] ?? fullName,
    fullName,
    email,
    level: isLevel(meta.level) ? meta.level : 'university',
  };
}

/** Las conversaciones y el progreso guardados son de otra cuenta: no se muestran. */
function startSession(user: User): void {
  const session = toSessionUser(user);
  setState((s) =>
    s.ownerId === session.id
      ? { ...s, session }
      : {
          ...s,
          session,
          ownerId: session.id,
          conversations: [],
          study: createInitialState().study,
          uploads: [],
        },
  );
  void refreshAll();
}

function endSession(): void {
  setState((s) => ({
    ...createInitialState(),
    settings: s.settings,
    ownerId: s.ownerId,
    conversations: s.conversations,
    study: s.study,
  }));
}

let authListening = false;

/** Carga los ajustes y conversaciones del dispositivo y recupera la sesión, si hay. */
export async function hydrate(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      if (parsed.version === 3) {
        state = {
          ...state,
          ownerId: parsed.ownerId ?? null,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          conversations: parsed.conversations ?? [],
          study: parsed.study ?? state.study,
        };
      }
    }
  } catch {
    // Datos dañados: se empieza de cero.
  }
  if (backendConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) startSession(data.session.user);
    } catch {
      // Sin red: la app abre en Inicio de sesión y avisa al intentar entrar.
    }
    if (!authListening) {
      authListening = true;
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') endSession();
        else if (event === 'USER_UPDATED' && session) {
          setState((s) => ({ ...s, session: toSessionUser(session.user) }));
        }
      });
    }
  }
  listeners.forEach((l) => l());
}

function authFailure(error: ErrorCode, field: AuthField): AuthResult {
  return { ok: false, error, field };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!backendConfigured) return authFailure('NET_UNAVAILABLE', 'password');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    if (error.code === 'email_not_confirmed') return authFailure('AUTH_EMAIL_UNCONFIRMED', 'email');
    if (error.status === 400 || error.code === 'invalid_credentials') {
      return authFailure('AUTH_INVALID', 'password');
    }
    return authFailure('NET_UNAVAILABLE', 'password');
  }
  startSession(data.user);
  return { ok: true };
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  /** DD/MM/AAAA */
  birthDate: string;
}

/**
 * Registro. Valida correo, contraseña (8+ caracteres, escrita dos veces igual) y fecha de
 * nacimiento. Los menores de 18 no crean cuenta: AUTH_MINOR lleva a la lista de espera (44).
 * La fecha de nacimiento no se guarda: solo que la persona confirmó ser mayor de edad.
 */
export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const email = input.email.trim();
  if (!isValidEmail(email)) return authFailure('AUTH_INVALID', 'email');
  if (isWeakPassword(input.password)) return authFailure('AUTH_WEAK_PASSWORD', 'password');
  if (input.password !== input.confirm) return authFailure('AUTH_PASSWORD_MISMATCH', 'confirm');
  const birth = parseBirthDate(input.birthDate);
  if (!birth) return authFailure('AUTH_BIRTHDATE_INVALID', 'birthDate');
  if (ageOn(birth) < ADULT_AGE) return authFailure('AUTH_MINOR', 'birthDate');
  if (!backendConfigured) return authFailure('NET_UNAVAILABLE', 'email');

  const fullName = input.fullName.trim() || (email.split('@')[0] ?? '');
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: fullName, level: 'university', adult_confirmed: true } },
  });
  if (error) {
    if (error.code === 'user_already_exists') return authFailure('AUTH_EMAIL_TAKEN', 'email');
    if (error.code === 'weak_password') return authFailure('AUTH_WEAK_PASSWORD', 'password');
    return authFailure('NET_UNAVAILABLE', 'email');
  }
  // Con la confirmación de correo activada, Supabase no abre sesión hasta usar el enlace.
  if (!data.session || !data.user) return { ok: true, needsConfirmation: true };
  startSession(data.user);
  return { ok: true };
}

/** Envía el enlace para elegir una contraseña nueva. */
export async function requestPasswordReset(email: string): Promise<boolean> {
  if (!backendConfigured) return false;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return !error;
}

/** Vuelve a enviar el correo de confirmación del registro. */
export async function resendSignupEmail(email: string): Promise<boolean> {
  if (!backendConfigured) return false;
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return !error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  endSession();
}

export function setLevel(level: Level): void {
  setState((s) => (s.session ? { ...s, session: { ...s.session, level } } : s));
  void supabase.auth.updateUser({ data: { level } });
}

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Borra archivos, datos y la cuenta en el servidor; luego limpia el dispositivo. */
export async function deleteAccount(): Promise<boolean> {
  try {
    await api.deleteAccount();
  } catch {
    return false;
  }
  await supabase.auth.signOut().catch(() => undefined);
  setState((s) => ({ ...createInitialState(), settings: s.settings }));
  return true;
}

export function joinWaitlist(email: string): void {
  setState((s) => ({ ...s, waitlist: [...new Set([...s.waitlist, email.trim()])] }));
}

// --- Documentos y cursos ---------------------------------------------------------

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    await api.deleteDocument(id);
  } catch {
    return false;
  }
  setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id) }));
  await refreshAll();
  return true;
}

export async function renameDocument(id: string, name: string): Promise<boolean> {
  try {
    await api.updateDocument(id, { title: name });
  } catch {
    return false;
  }
  await refreshAll();
  return true;
}

export async function moveDocument(id: string, courseId: string): Promise<boolean> {
  try {
    await api.updateDocument(id, { courseId });
  } catch {
    return false;
  }
  await refreshAll();
  return true;
}

/** Temas detectados en los encabezados del documento (los genera el worker). */
export async function loadDocumentTopics(id: string): Promise<void> {
  try {
    const { topics } = await api.topics(id);
    const titles = topics.map((t) => t.title);
    setState((s) => ({
      ...s,
      documents: s.documents.map((d) => (d.id === id ? { ...d, topics: titles } : d)),
    }));
  } catch {
    // Sin temas: la pantalla muestra el documento igual.
  }
}

/** Crea el curso en el servidor y devuelve su id, o null si falló. */
export async function createCourse(title: string): Promise<string | null> {
  try {
    const course = await api.createCourse(title.trim());
    await refreshAll();
    return course.id;
  } catch {
    return null;
  }
}

// --- Subida ----------------------------------------------------------------------

export interface PickedFile {
  name: string;
  sizeMb: number;
  sizeBytes: number;
  /** Ruta local (teléfono). */
  uri: string;
  mimeType?: string;
  /** Archivo del navegador (web). */
  webFile?: Blob;
}

export function fileFromPicker(asset: {
  name: string;
  size?: number | null;
  uri: string;
  mimeType?: string | null;
  file?: Blob;
}): PickedFile {
  const sizeBytes = asset.size ?? 0;
  return {
    name: asset.name,
    sizeBytes,
    sizeMb: Math.round((sizeBytes / MB) * 10) / 10,
    uri: asset.uri,
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
    ...(asset.file ? { webFile: asset.file } : {}),
  };
}

export { extensionOf };

/** Archivos elegidos, por id de subida: no se guardan en el estado (no son serializables). */
const pickedFiles = new Map<string, PickedFile>();

function patchUpload(id: string, patch: Partial<UploadJob>): void {
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)),
  }));
}

function uploadExists(id: string): boolean {
  return state.uploads.some((u) => u.id === id);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Registrar → subir directo a R2 → encolar → esperar al worker. Nunca bloquea la interfaz. */
async function runUpload(jobId: string): Promise<void> {
  const file = pickedFiles.get(jobId);
  if (!file) return;
  let documentId: string | undefined;
  try {
    const ticket = await api.createDocument({ fileName: file.name, sizeBytes: file.sizeBytes });
    documentId = ticket.documentId;
    patchUpload(jobId, { documentId, progress: 0.3 });
    await putFile(ticket.uploadUrl, ticket.uploadHeaders, file);
    if (!uploadExists(jobId)) return;
    patchUpload(jobId, { progress: 1 });
    await api.completeDocument(documentId);
    patchUpload(jobId, { status: 'processing', progress: 0.1 });
    void refreshUsage();
  } catch (error) {
    patchUpload(jobId, { status: 'failed', error: toErrorCode(error, 'UP_NETWORK') });
    // Si se registró pero no se subió, se borra para devolver el espacio.
    if (documentId) void api.deleteDocument(documentId).catch(() => undefined);
    patchUpload(jobId, { documentId: undefined });
    return;
  }

  const started = Date.now();
  while (uploadExists(jobId) && Date.now() - started < POLL_LIMIT_MS) {
    await wait(POLL_MS);
    try {
      const doc = await api.document(documentId);
      if (doc.status === 'completed') {
        patchUpload(jobId, { status: 'review', progress: 1 });
        pickedFiles.delete(jobId);
        void refreshAll();
        return;
      }
      if (doc.status === 'failed') {
        patchUpload(jobId, { status: 'failed', error: 'UP_UNREADABLE' });
        return;
      }
      // Avance aproximado: el worker no informa porcentajes.
      patchUpload(jobId, {
        progress: Math.min(0.9, 0.1 + (Date.now() - started) / (2 * 60 * 1000)),
      });
    } catch {
      // Un corte de red mientras se procesa no detiene el trabajo en el servidor.
    }
  }
}

/** Registra los archivos: los inválidos quedan como fallidos con su código; los válidos se suben. */
export function enqueueUploads(files: readonly PickedFile[]): UploadJob[] {
  let used = usedMb(state);
  const quota = quotaMb(state);
  const queued = new Set(
    state.uploads.filter((u) => u.status !== 'done').map((u) => `${u.name}|${u.sizeMb}`),
  );
  const fresh = files.filter((f) => {
    const key = `${f.name}|${f.sizeMb}`;
    if (queued.has(key)) return false;
    queued.add(key);
    return true;
  });
  const jobs: UploadJob[] = fresh.map((f) => {
    const error = validateUpload(f, used, quota);
    if (!error) used += f.sizeMb;
    const id = newId('up');
    pickedFiles.set(id, f);
    return {
      id,
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
  for (const job of jobs) if (job.status === 'uploading') void runUpload(job.id);
  return jobs;
}

export function retryUpload(id: string): void {
  const job = state.uploads.find((u) => u.id === id);
  const file = pickedFiles.get(id);
  if (!job || !file) return;
  const error = validateUpload(file, usedMb(state), quotaMb(state));
  if (error) {
    patchUpload(id, { error });
    return;
  }
  if (job.documentId) void api.deleteDocument(job.documentId).catch(() => undefined);
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) =>
      u.id === id
        ? {
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
  void runUpload(id);
}

/** Quita el archivo de la lista; si ya estaba en el servidor sin confirmar, lo borra. */
export function removeUpload(id: string): void {
  const job = state.uploads.find((u) => u.id === id);
  if (job?.documentId && job.status !== 'done') {
    void api
      .deleteDocument(job.documentId)
      .then(refreshAll)
      .catch(() => undefined);
  }
  pickedFiles.delete(id);
  setState((s) => ({ ...s, uploads: s.uploads.filter((u) => u.id !== id) }));
}

export function assignUploadCourse(id: string, courseId: string): void {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return;
  setState((s) => ({
    ...s,
    uploads: s.uploads.map((u) =>
      u.id === id
        ? { ...u, courseId, path: [course.title, stripExtension(u.name)], confident: true }
        : u,
    ),
  }));
}

/** Guarda en su curso los archivos confirmados. Devuelve cuántos se guardaron. */
export async function confirmUploads(): Promise<number> {
  const ready = state.uploads.filter((u) => u.status === 'review' && u.courseId && u.documentId);
  let saved = 0;
  for (const job of ready) {
    try {
      await api.updateDocument(job.documentId ?? '', { courseId: job.courseId ?? null });
      patchUpload(job.id, { status: 'done' });
      saved += 1;
    } catch {
      // Queda en revisión para intentarlo otra vez.
    }
  }
  await refreshAll();
  return saved;
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

// --- Chat --------------------------------------------------------------------------

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

/** Registra la pregunta. Devuelve false si ya se alcanzó el límite diario (no se envía). */
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
  return true;
}

function courseTitleOf(documentId: string): string {
  const doc = state.documents.find((d) => d.id === documentId);
  return state.courses.find((c) => c.id === doc?.courseId)?.title ?? '';
}

/**
 * Pregunta al servidor: responde solo con fragmentos propios y cada afirmación lleva su
 * página, verificada por el validador. Si no hay respaldo, la mascota lo dice.
 */
export async function answerQuestion(conversationId: string, question: string): Promise<void> {
  if (!state.settings.useDocs) {
    appendMessages(conversationId, [
      { id: newId('m'), role: 'mascot', kind: 'notFound', text: '' },
    ]);
    return;
  }
  try {
    const answer = await api.ask(question);
    if (answer.status === 'abstained') {
      appendMessages(conversationId, [
        { id: newId('m'), role: 'mascot', kind: 'notFound', text: '' },
      ]);
    } else {
      const sources = new Map<string, { page: number; klass: number; documentId: string }>();
      const lines = answer.claims.map((claim) => {
        const pages = [...new Set(claim.citations.map((c) => c.pageNumber))];
        for (const c of claim.citations) {
          sources.set(`${c.documentId}-${c.pageNumber}`, {
            page: c.pageNumber,
            klass: 0,
            documentId: c.documentId,
          });
        }
        return `${claim.text} ${pages.map((p) => `[pág. ${p}]`).join(' ')}`;
      });
      const first = [...sources.values()][0];
      appendMessages(
        conversationId,
        [
          {
            id: newId('m'),
            role: 'mascot',
            kind: 'answer',
            text: lines.join('\n'),
            sources: [...sources.values()],
          },
        ],
        first ? { course: courseTitleOf(first.documentId) } : {},
      );
    }
  } catch (error) {
    const limit = error instanceof ApiRequestError && error.code === 'CHAT_DAILY_LIMIT';
    appendMessages(conversationId, [
      { id: newId('m'), role: 'mascot', kind: limit ? 'limit' : 'error', text: '' },
    ]);
  }
  void refreshUsage();
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** "Buscar fuera" (pantalla 30): resultados de internet aparte, cada uno con su fuente. */
export async function searchOutside(conversationId: string, question: string): Promise<void> {
  try {
    const { results } = await api.external(question);
    const messages: Message[] =
      results.length === 0
        ? [{ id: newId('m'), role: 'mascot', kind: 'external', text: '' }]
        : results.map((r) => ({
            id: newId('m'),
            role: 'mascot',
            kind: 'external',
            text: r.snippet,
            external: { title: r.title, host: hostOf(r.url), url: r.url },
          }));
    appendMessages(conversationId, messages);
  } catch (error) {
    const limit = error instanceof ApiRequestError && error.code === 'CHAT_DAILY_LIMIT';
    appendMessages(conversationId, [
      { id: newId('m'), role: 'mascot', kind: limit ? 'limit' : 'error', text: '' },
    ]);
  }
  void refreshUsage();
}

// --- Estudio (fase 3: quizzes y tarjetas generados desde tus documentos) ------------

export function recordQuiz(score: number, total: number): void {
  setState((s) => ({ ...s, study: { ...s.study, lastQuiz: { score, total } } }));
}

/** Califica una tarjeta y agenda su próximo repaso. Devuelve en cuántos días vuelve. */
export function gradeCard(cardId: string, known: boolean, today: Date = new Date()): number {
  const box = nextBox(state.study.boxes?.[cardId]?.box ?? 0, known);
  const days = daysUntilNext(box);
  const due = new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
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
      boxes: { ...s.study.boxes, [cardId]: { box, due } },
    },
  }));
  return days;
}

// --- Planes y compartir (fase 4: solo en la vista previa del diseño) ----------------

export function choosePlan(plan: Plan): void {
  setState((s) => ({ ...s, plan }));
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

// --- Búsqueda (pantalla 39): nombres de documentos y chats --------------------------

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
    if (matches(query, `${doc.name} ${course}`)) {
      hits.push({
        id: doc.id,
        kind: 'document',
        targetId: doc.id,
        title: doc.name,
        location: doc.pages > 0 ? `${doc.pages} páginas` : '',
        snippet: doc.topics.join(' · '),
        tag: course,
      });
    }
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

// --- Perfil ------------------------------------------------------------------------

/**
 * Actualiza nombre y correo. Un correo nuevo no se aplica hasta confirmarlo con el enlace
 * que envía Supabase (a ambos correos, según la configuración del proyecto).
 */
export async function updateProfile(patch: {
  fullName: string;
  email: string;
}): Promise<AuthResult> {
  const email = patch.email.trim();
  if (!isValidEmail(email)) return authFailure('AUTH_INVALID', 'email');
  const fullName = patch.fullName.trim() || state.session?.fullName || '';
  const changingEmail = email.toLowerCase() !== (state.session?.email ?? '').toLowerCase();
  const { error } = await supabase.auth.updateUser({
    ...(changingEmail ? { email } : {}),
    data: { full_name: fullName },
  });
  if (error) {
    if (error.code === 'email_exists') return authFailure('AUTH_EMAIL_TAKEN', 'email');
    return authFailure('NET_UNAVAILABLE', 'email');
  }
  setState((s) =>
    s.session
      ? { ...s, session: { ...s.session, fullName, name: fullName.split(' ')[0] ?? fullName } }
      : s,
  );
  return changingEmail ? { ok: true, needsConfirmation: true } : { ok: true };
}

/** Cambia la contraseña: comprueba la actual, exige la nueva dos veces y 8+ caracteres. */
export async function changePassword(
  currentPassword: string,
  next: string,
  confirm: string,
): Promise<AuthResult> {
  const email = state.session?.email;
  if (!email) return authFailure('AUTH_INVALID', 'password');
  if (isWeakPassword(next)) return authFailure('AUTH_WEAK_PASSWORD', 'password');
  if (next !== confirm) return authFailure('AUTH_PASSWORD_MISMATCH', 'password');
  const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (check.error) return authFailure('AUTH_INVALID', 'password');
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return authFailure('AUTH_WEAK_PASSWORD', 'password');
  return { ok: true };
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
      usuario: s.session ? { nombre: s.session.fullName, correo: s.session.email } : null,
      ajustes: s.settings,
      plan: s.plan,
      cursos: s.courses.map((c) => c.title),
      documentos: s.documents.map((d) => ({ nombre: d.name, curso: d.path[0], paginas: d.pages })),
      conversaciones: s.conversations.map((c) => ({
        titulo: c.title,
        mensajes: c.messages.map((m) => ({ de: m.role, texto: m.text })),
      })),
    },
    null,
    2,
  );
}

// --- Contenido por clase y temas (fase 2) --------------------------------------------

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

export function topicDetail(s: AppState, topicId: string): TopicDetail | null {
  return s.topics[topicId] ?? null;
}

/** Para pruebas: vuelve al estado inicial. */
export function resetForTests(): void {
  state = createInitialState();
  pickedFiles.clear();
}

export { DEFAULT_USAGE };
