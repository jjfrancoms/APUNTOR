import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGAL_VERSION } from '../src/i18n/legal';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) },
}));

vi.mock('@/lib/config', () => ({
  config: { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'pk', apiUrl: 'http://api' },
  backendConfigured: true,
  PREVIEW: false,
}));

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(
    async (_attrs: unknown): Promise<{ error: { code: string; status: number } | null }> => ({
      error: null,
    }),
  ),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  resend: vi.fn(async () => ({ error: null })),
  exchangeCodeForSession: vi.fn(),
  signInWithOAuth: vi.fn(),
};
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

const links = {
  usesBrowserRedirect: false,
  authReturnUrl: vi.fn((route: string) => `exp://192.168.1.20:8081/--/${route}`),
  openAuthSession: vi.fn<(url: string, returnUrl: string) => Promise<string | null>>(),
};
vi.mock('@/lib/auth-links', () => links);

const putFile = vi.fn(async () => undefined);
vi.mock('@/lib/upload-transfer', () => ({ putFile }));

class FakeApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
const api = {
  usage: vi.fn(async () => ({
    questionsToday: 3,
    questionsLimit: 20,
    storageBytes: 10 * 1024 * 1024,
    storageLimit: 500 * 1024 * 1024,
  })),
  courses: vi.fn(async () => ({ courses: [{ id: 'c1', title: 'Cálculo I', createdAt: '' }] })),
  documents: vi.fn(async () => ({
    documents: [
      doc({ id: 'd1', courseId: 'c1', title: 'Límites.pdf', topicCount: 4 }),
      doc({ id: 'd2', courseId: null, title: 'Suelto.pdf', topicCount: 1 }),
    ],
  })),
  document: vi.fn(),
  topics: vi.fn(),
  createCourse: vi.fn(),
  createDocument: vi.fn(async () => ({
    documentId: 'srv-1',
    uploadUrl: 'https://r2/put',
    uploadHeaders: { 'Content-Type': 'application/pdf' },
  })),
  completeDocument: vi.fn(async () => ({})),
  updateDocument: vi.fn(async () => ({})),
  classifyDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => undefined),
  deleteAccount: vi.fn(async () => undefined),
  exportAccount: vi.fn(async (): Promise<unknown> => ({ profile: { id: 'u1' } })),
  joinWaitlist: vi.fn(async () => ({ status: 'joined' as const })),
  ask: vi.fn(),
  external: vi.fn(),
  acceptConsent: vi.fn(async (document: string, version: string) => ({
    document,
    version,
    acceptedAt: new Date().toISOString(),
  })),
  // Por defecto la cuenta ya aceptó la versión vigente de ambos documentos.
  consents: vi.fn(
    async (): Promise<{
      consents: { document: 'terms' | 'privacy'; version: string; acceptedAt: string }[];
    }> => ({
      consents: [
        { document: 'terms', version: LEGAL_VERSION, acceptedAt: '' },
        { document: 'privacy', version: LEGAL_VERSION, acceptedAt: '' },
      ],
    }),
  ),
  // Por defecto la cuenta no es administradora (403 FORBIDDEN).
  adminMe: vi.fn(async (): Promise<{ admin: true; email: string }> => {
    throw new FakeApiError('FORBIDDEN', 403);
  }),
  adminStats: vi.fn(),
  adminUsers: vi.fn(),
  adminDocuments: vi.fn(),
  adminRetryDocument: vi.fn(async (id: string) => ({ id, status: 'pending' as const })),
  adminDeleteUser: vi.fn(async (_id: string) => undefined),
  adminAudit: vi.fn(),
};
vi.mock('@/lib/api', () => ({
  api,
  ApiRequestError: FakeApiError,
  toErrorCode: (error: unknown, fallback: string) =>
    error instanceof FakeApiError && error.code.startsWith('UP_') ? error.code : fallback,
}));

function doc(over: { id: string; courseId: string | null; title: string; topicCount: number }): {
  id: string;
  courseId: string | null;
  title: string;
  topicCount: number;
  sizeBytes: number;
  status: 'completed';
  totalPages: number;
  classificationStatus: 'none' | 'suggested' | 'confirmed' | 'dismissed';
  suggestedCourseId: string | null;
  suggestedCourseTitle: string | null;
  suggestionConfidence: number | null;
  suggestionReason: string | null;
  createdAt: string;
} {
  return {
    sizeBytes: 2 * 1024 * 1024,
    status: 'completed' as const,
    totalPages: 12,
    classificationStatus: 'none',
    suggestedCourseId: null,
    suggestedCourseTitle: null,
    suggestionConfidence: null,
    suggestionReason: null,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const user = (id: string, name = 'Ana Torres', adult = true) => ({
  id,
  email: `${id}@correo.com`,
  user_metadata: {
    full_name: name,
    level: 'university',
    ...(adult ? { adult_confirmed: true } : {}),
  },
});

const store = await import('../src/store/store');

function file(name: string, sizeMb: number) {
  return { name, sizeMb, sizeBytes: Math.round(sizeMb * 1024 * 1024), uri: `file:///${name}` };
}

async function signedIn(id = 'u1') {
  auth.signInWithPassword.mockResolvedValueOnce({ data: { user: user(id) }, error: null });
  await store.signIn('ana@correo.com', 'secreta123');
  await vi.waitFor(() => expect(store.getState().sync.loading).toBe(false));
}

beforeEach(() => {
  store.resetForTests();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('cuenta', () => {
  it('sin datos de prueba: el estado inicial está vacío', () => {
    const s = store.getState();
    expect([s.session, s.courses, s.documents, s.conversations]).toEqual([null, [], [], []]);
  });

  it('entra con Supabase y traduce sus errores a códigos de la app', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { status: 400, code: 'invalid_credentials' },
    });
    expect(await store.signIn('a@b.com', 'x')).toEqual({
      ok: false,
      error: 'AUTH_INVALID',
      field: 'password',
    });
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { status: 400, code: 'email_not_confirmed' },
    });
    expect(await store.signIn('a@b.com', 'x')).toMatchObject({ error: 'AUTH_EMAIL_UNCONFIRMED' });
    await signedIn();
    expect(store.getState().session).toMatchObject({ id: 'u1', name: 'Ana' });
  });

  it('valida el registro antes de llamar al servidor', async () => {
    const base = {
      fullName: 'Ana',
      email: 'ana@correo.com',
      password: 'secreta123',
      confirm: 'secreta123',
      birthDate: '01/01/2000',
    };
    expect(await store.signUp({ ...base, email: 'no-es-correo' })).toMatchObject({
      error: 'AUTH_INVALID',
    });
    expect(await store.signUp({ ...base, password: 'corta', confirm: 'corta' })).toMatchObject({
      error: 'AUTH_WEAK_PASSWORD',
    });
    expect(await store.signUp({ ...base, confirm: 'otra12345' })).toMatchObject({
      error: 'AUTH_PASSWORD_MISMATCH',
    });
    expect(await store.signUp({ ...base, birthDate: '31/02/2000' })).toMatchObject({
      error: 'AUTH_BIRTHDATE_INVALID',
    });
    const minor = new Date().getFullYear() - 10;
    expect(await store.signUp({ ...base, birthDate: `01/01/${minor}` })).toMatchObject({
      error: 'AUTH_MINOR',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('registra sin guardar la fecha de nacimiento y avisa si falta confirmar el correo', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    const r = await store.signUp({
      fullName: 'Ana',
      email: 'ana@correo.com',
      password: 'secreta123',
      confirm: 'secreta123',
      birthDate: '01/01/2000',
    });
    expect(r).toEqual({ ok: true, needsConfirmation: true });
    const sent = JSON.stringify(auth.signUp.mock.calls[0]);
    expect(sent).not.toContain('2000');
    expect(sent).toContain('adult_confirmed');
  });

  it('correo ya registrado → AUTH_EMAIL_TAKEN', async () => {
    auth.signUp.mockResolvedValueOnce({ data: {}, error: { code: 'user_already_exists' } });
    expect(
      await store.signUp({
        fullName: 'Ana',
        email: 'ana@correo.com',
        password: 'secreta123',
        confirm: 'secreta123',
        birthDate: '01/01/2000',
      }),
    ).toMatchObject({ error: 'AUTH_EMAIL_TAKEN' });
  });

  it('otra cuenta en el mismo teléfono no ve las conversaciones de la anterior', async () => {
    await signedIn('u1');
    store.startConversation();
    expect(store.getState().conversations).toHaveLength(1);
    await signedIn('u2');
    expect(store.getState().conversations).toEqual([]);
  });

  it('si el servidor no borra la cuenta, no se pierde la sesión', async () => {
    await signedIn();
    api.deleteAccount.mockRejectedValueOnce(new Error('caído'));
    expect(await store.deleteAccount()).toBe(false);
    expect(store.getState().session).not.toBeNull();
    expect(await store.deleteAccount()).toBe(true);
    expect(store.getState().session).toBeNull();
  });
});

describe('datos del servidor', () => {
  it('arma los cursos con sus documentos y deja los sueltos sin curso', async () => {
    await signedIn();
    const s = store.getState();
    expect(s.courses).toHaveLength(1);
    expect(s.courses[0]).toMatchObject({ title: 'Cálculo I', topicCount: 4, documentCount: 1 });
    expect(s.courses[0]?.classes.map((k) => k.title)).toEqual(['Límites']);
    expect(s.documents.find((d) => d.id === 'd2')).toMatchObject({ courseId: '', path: [] });
    expect(store.usedMb(s)).toBe(10);
    expect(store.questionsToday(s)).toBe(3);
  });

  it('si el servidor no responde, avisa en lugar de mostrar datos', async () => {
    api.courses.mockRejectedValueOnce(new Error('sin red'));
    await signedIn();
    expect(store.getState().sync.error).toBe('NET_UNAVAILABLE');
    expect(store.getState().courses).toEqual([]);
  });
});

describe('subida', () => {
  it('valida formato, tamaño y espacio antes de subir', async () => {
    await signedIn();
    const jobs = store.enqueueUploads([file('video.mp4', 1), file('grande.pdf', 60)]);
    expect(jobs.map((j) => j.error)).toEqual(['UP_FORMAT', 'UP_SIZE']);
    expect(api.createDocument).not.toHaveBeenCalled();
  });

  it('no duplica un archivo que ya está en la cola', async () => {
    await signedIn();
    api.document.mockResolvedValue({ status: 'processing' });
    store.enqueueUploads([file('a.pdf', 1)]);
    expect(store.enqueueUploads([file('a.pdf', 1)])).toEqual([]);
  });

  it('registra, sube directo a R2, encola y espera al worker', async () => {
    vi.useFakeTimers();
    await signedIn();
    api.document.mockResolvedValue({ status: 'completed' });
    const [job] = store.enqueueUploads([file('a.pdf', 1)]);
    await vi.advanceTimersByTimeAsync(3500);
    expect(api.createDocument).toHaveBeenCalledWith({ fileName: 'a.pdf', sizeBytes: 1048576 });
    expect(putFile).toHaveBeenCalledWith(
      'https://r2/put',
      { 'Content-Type': 'application/pdf' },
      expect.objectContaining({ name: 'a.pdf' }),
    );
    expect(api.completeDocument).toHaveBeenCalledWith('srv-1');
    expect(store.getState().uploads.find((u) => u.id === job?.id)).toMatchObject({
      status: 'review',
      documentId: 'srv-1',
    });
  });

  it('si el worker no puede leer el archivo, queda como fallido (UP_UNREADABLE)', async () => {
    vi.useFakeTimers();
    await signedIn();
    api.document.mockResolvedValue({ status: 'failed' });
    const [job] = store.enqueueUploads([file('escaneo.pdf', 1)]);
    await vi.advanceTimersByTimeAsync(3500);
    expect(store.getState().uploads.find((u) => u.id === job?.id)?.error).toBe('UP_UNREADABLE');
  });

  it('si la subida a R2 falla, borra el registro para devolver el espacio', async () => {
    await signedIn();
    putFile.mockRejectedValueOnce(new Error('sin red'));
    const [job] = store.enqueueUploads([file('a.pdf', 1)]);
    await vi.waitFor(() =>
      expect(store.getState().uploads.find((u) => u.id === job?.id)?.status).toBe('failed'),
    );
    expect(api.deleteDocument).toHaveBeenCalledWith('srv-1');
  });

  it('solo los documentos con sugerencia pendiente cuentan como por revisar', async () => {
    api.documents.mockResolvedValueOnce({
      documents: [
        {
          ...doc({ id: 'd1', courseId: null, title: 'A.pdf', topicCount: 1 }),
          classificationStatus: 'suggested' as const,
          suggestedCourseId: 'c1',
          suggestedCourseTitle: 'Cálculo I',
          suggestionConfidence: 0.8,
          suggestionReason: 'Habla de límites',
        },
        {
          ...doc({ id: 'd2', courseId: 'c1', title: 'B.pdf', topicCount: 1 }),
          classificationStatus: 'confirmed' as const,
        },
      ],
    });
    await signedIn();
    const pending = store.pendingReview(store.getState());
    expect(pending.map((d) => d.id)).toEqual(['d1']);
    expect(pending[0]?.classification).toMatchObject({ courseTitle: 'Cálculo I', confidence: 0.8 });
  });

  it('decideClassification manda la decisión y recarga; si falla devuelve false', async () => {
    await signedIn();
    expect(await store.decideClassification('d1', { action: 'accept' })).toBe(true);
    expect(api.classifyDocument).toHaveBeenCalledWith('d1', { action: 'accept' });
    api.classifyDocument.mockRejectedValueOnce(new Error('sin red'));
    expect(await store.decideClassification('d1', { action: 'dismiss' })).toBe(false);
  });
});

describe('chat', () => {
  it('muestra cada afirmación con su página y enlaza al documento', async () => {
    await signedIn();
    api.ask.mockResolvedValueOnce({
      status: 'answered',
      claims: [
        {
          label: 'Límite',
          formula: 'lím f(x)',
          text: 'Describe el valor al que se acerca f(x).',
          citations: [{ chunkId: 'k', documentId: 'd1', pageNumber: 12, quote: 'el valor' }],
        },
      ],
    });
    const id = store.startConversation();
    expect(store.askQuestion(id, '¿Qué es un límite?')).toBe(true);
    await store.answerQuestion(id, '¿Qué es un límite?');
    const last = store.getState().conversations[0]?.messages.at(-1);
    expect(last).toMatchObject({
      kind: 'answer',
      text: 'Límite · lím f(x) · Describe el valor al que se acerca f(x).',
      sources: [{ page: 12, documentId: 'd1' }],
      claims: [
        {
          label: 'Límite',
          formula: 'lím f(x)',
          text: 'Describe el valor al que se acerca f(x).',
          pages: [{ documentId: 'd1', page: 12 }],
        },
      ],
    });
    expect(store.getState().conversations[0]?.course).toBe('Cálculo I');
  });

  it('el alcance viaja al servidor, se conserva al reintentar y se puede ampliar', async () => {
    await signedIn();
    api.ask.mockResolvedValue({ status: 'small_talk', kind: 'greeting' });
    const id = store.startConversation(['d1']);
    expect(store.getState().conversations[0]?.scopeDocIds).toEqual(['d1']);
    store.askQuestion(id, 'Hola');
    await store.answerQuestion(id, 'Hola');
    expect(api.ask.mock.calls.at(-1)?.[1]).toMatchObject({ documentIds: ['d1'] });
    store.retryLastQuestion(id);
    await vi.waitFor(() => expect(api.ask.mock.calls.length).toBeGreaterThan(1));
    expect(api.ask.mock.calls.at(-1)?.[1]).toMatchObject({ documentIds: ['d1'] });
    await vi.waitFor(() => expect(store.getState().pendingAnswers[id]).toBeUndefined());
    store.widenConversationScope(id);
    expect(store.getState().conversations[0]?.scopeDocIds).toBeUndefined();
    await store.answerQuestion(id, 'Hola otra vez');
    expect(api.ask.mock.calls.at(-1)?.[1]).not.toHaveProperty('documentIds');
  });

  it('un saludo se responde con un texto de la app', async () => {
    await signedIn();
    api.ask.mockResolvedValueOnce({ status: 'small_talk', kind: 'greeting' });
    const id = store.startConversation();
    await store.answerQuestion(id, 'Hola');
    expect(store.getState().conversations[0]?.messages.at(-1)).toMatchObject({
      role: 'mascot',
      kind: 'smallTalk',
      smallTalk: 'greeting',
    });
  });

  it('si no está en los apuntes, la mascota lo dice', async () => {
    await signedIn();
    api.ask.mockResolvedValueOnce({ status: 'abstained', message: 'No encontré esto' });
    const id = store.startConversation();
    await store.answerQuestion(id, 'x');
    expect(store.getState().conversations[0]?.messages.at(-1)?.kind).toBe('notFound');
  });

  it('el límite diario y los fallos llegan como avisos, no como respuestas', async () => {
    await signedIn();
    const id = store.startConversation();
    api.ask.mockRejectedValueOnce(new FakeApiError('CHAT_DAILY_LIMIT', 429));
    await store.answerQuestion(id, 'x');
    api.ask.mockRejectedValueOnce(new FakeApiError('CHAT_FAILED', 502));
    await store.answerQuestion(id, 'x');
    expect(store.getState().conversations[0]?.messages.map((m) => m.kind)).toEqual([
      'limit',
      'error',
    ]);
  });

  it('no usa los documentos si la persona lo desactivó', async () => {
    await signedIn();
    store.updateSettings({ useDocs: false });
    const id = store.startConversation();
    await store.answerQuestion(id, 'x');
    expect(api.ask).not.toHaveBeenCalled();
  });

  it('lo de internet llega aparte, con su fuente', async () => {
    await signedIn();
    api.external.mockResolvedValueOnce({
      source: 'internet',
      results: [{ title: 'Historia', url: 'https://es.wikipedia.org/wiki/X', snippet: 'Dato' }],
    });
    const id = store.startConversation();
    await store.searchOutside(id, 'x');
    expect(store.getState().conversations[0]?.messages.at(-1)).toMatchObject({
      kind: 'external',
      text: 'Dato',
      external: { host: 'es.wikipedia.org', url: 'https://es.wikipedia.org/wiki/X' },
    });
  });
});

describe('chat: respuesta en camino', () => {
  /** api.ask que espera hasta que se aborte su señal (como el fetch real). */
  function askUntilAborted() {
    api.ask.mockImplementationOnce(
      (_q: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new FakeApiError('CANCELLED', 0)),
          );
        }),
    );
  }

  it('marca la conversación como pendiente durante la llamada y la limpia al terminar', async () => {
    await signedIn();
    let resolve: (value: unknown) => void = () => undefined;
    api.ask.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    const id = store.startConversation();
    store.askQuestion(id, 'Hola');
    const pending = store.answerQuestion(id, 'Hola');
    expect(store.isAnswerPending(store.getState(), id)).toBe(true);
    expect(store.getState().pendingAnswers[id]).toMatchObject({ question: 'Hola', kind: 'notes' });
    expect(api.ask).toHaveBeenCalledWith('Hola', {
      signal: expect.any(AbortSignal),
      timeoutMs: store.CHAT_TIMEOUT_MS,
    });
    // Una pregunta a la vez: la segunda no llama al servidor.
    await store.answerQuestion(id, 'otra');
    expect(api.ask).toHaveBeenCalledTimes(1);
    resolve({ status: 'small_talk', kind: 'greeting' });
    await pending;
    expect(store.isAnswerPending(store.getState(), id)).toBe(false);
    expect(store.getState().conversations[0]?.messages.at(-1)?.kind).toBe('smallTalk');
  });

  it('detener deja un aviso de cancelación y limpia el pendiente', async () => {
    await signedIn();
    askUntilAborted();
    const id = store.startConversation();
    store.askQuestion(id, '¿Qué es un límite?');
    const pending = store.answerQuestion(id, '¿Qué es un límite?');
    store.cancelAnswer(id);
    await pending;
    expect(store.isAnswerPending(store.getState(), id)).toBe(false);
    expect(store.getState().conversations[0]?.messages.map((m) => m.kind)).toEqual([
      'text',
      'cancelled',
    ]);
    // Sin nada en camino, detener no hace nada.
    expect(() => store.cancelAnswer(id)).not.toThrow();
  });

  it('cerrar sesión corta la petición sin dejar avisos', async () => {
    await signedIn();
    askUntilAborted();
    const id = store.startConversation();
    store.askQuestion(id, 'x');
    const pending = store.answerQuestion(id, 'x');
    await store.signOut();
    await pending;
    expect(store.getState().pendingAnswers).toEqual({});
    expect(store.getState().conversations[0]?.messages.map((m) => m.kind)).toEqual(['text']);
  });

  it('tiempo agotado, red y saturación llegan como error con su código', async () => {
    await signedIn();
    const id = store.startConversation();
    api.ask.mockRejectedValueOnce(new FakeApiError('TIMEOUT', 0));
    await store.answerQuestion(id, 'x');
    api.ask.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    await store.answerQuestion(id, 'x');
    api.ask.mockRejectedValueOnce(new FakeApiError('RATE_LIMITED', 429));
    await store.answerQuestion(id, 'x');
    api.ask.mockRejectedValueOnce(new FakeApiError('INTERNAL', 500));
    await store.answerQuestion(id, 'x');
    expect(store.getState().conversations[0]?.messages.map((m) => [m.kind, m.errorCode])).toEqual([
      ['error', 'TIMEOUT'],
      ['error', 'NETWORK'],
      ['error', 'RATE_LIMITED'],
      ['error', 'CHAT_FAILED'],
    ]);
    expect(store.isAnswerPending(store.getState(), id)).toBe(false);
  });

  it('reintentar no repite la burbuja de la persona', async () => {
    await signedIn();
    const id = store.startConversation();
    store.askQuestion(id, '¿Qué es un límite?');
    api.ask.mockRejectedValueOnce(new FakeApiError('TIMEOUT', 0));
    await store.answerQuestion(id, '¿Qué es un límite?');
    api.ask.mockResolvedValueOnce({ status: 'small_talk', kind: 'thanks' });
    store.retryLastQuestion(id);
    await vi.waitFor(() => expect(store.isAnswerPending(store.getState(), id)).toBe(false));
    expect(api.ask).toHaveBeenLastCalledWith('¿Qué es un límite?', expect.anything());
    expect(store.getState().conversations[0]?.messages.map((m) => [m.role, m.kind])).toEqual([
      ['user', 'text'],
      ['mascot', 'smallTalk'],
    ]);
  });

  it('editar quita la última pregunta con su respuesta y devuelve el texto', async () => {
    await signedIn();
    const id = store.startConversation();
    store.askQuestion(id, 'primera');
    api.ask.mockResolvedValueOnce({ status: 'small_talk', kind: 'greeting' });
    await store.answerQuestion(id, 'primera');
    store.askQuestion(id, 'segunda');
    api.ask.mockRejectedValueOnce(new FakeApiError('CHAT_FAILED', 502));
    await store.answerQuestion(id, 'segunda');
    expect(store.editLastQuestion(id)).toBe('segunda');
    expect(store.getState().conversations[0]?.messages.map((m) => m.text || m.kind)).toEqual([
      'primera',
      'smallTalk',
    ]);
  });

  it('no se puede editar ni reintentar mientras hay una respuesta en camino', async () => {
    await signedIn();
    askUntilAborted();
    const id = store.startConversation();
    store.askQuestion(id, 'x');
    const pending = store.answerQuestion(id, 'x');
    expect(store.editLastQuestion(id)).toBeNull();
    store.retryLastQuestion(id);
    expect(api.ask).toHaveBeenCalledTimes(1);
    store.cancelAnswer(id);
    await pending;
    expect(store.editLastQuestion(store.startConversation())).toBeNull();
  });

  it('"no encontrado" lleva el motivo y marca las preguntas que parecen incompletas', async () => {
    await signedIn();
    const id = store.startConversation();
    api.ask.mockResolvedValueOnce({ status: 'abstained', message: '', reason: 'no_matches' });
    await store.answerQuestion(id, 'loa');
    api.ask.mockResolvedValueOnce({ status: 'abstained', message: '', reason: 'no_matches' });
    await store.answerQuestion(id, '¿Qué dice el teorema de Bolzano?');
    api.ask.mockResolvedValueOnce({
      status: 'abstained',
      message: '',
      reason: 'validation_failed',
    });
    await store.answerQuestion(id, 'loa');
    const [first, second, third] = store.getState().conversations[0]?.messages ?? [];
    expect(first).toMatchObject({ kind: 'notFound', reason: 'no_matches', unclear: true });
    expect(second).toMatchObject({ kind: 'notFound', reason: 'no_matches' });
    expect(second?.unclear).toBeUndefined();
    expect(third).toMatchObject({ kind: 'notFound', reason: 'validation_failed' });
    expect(third?.unclear).toBeUndefined();
  });

  it('buscar fuera usa el mismo pendiente y se puede detener', async () => {
    await signedIn();
    api.external.mockImplementationOnce(
      (_q: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new FakeApiError('CANCELLED', 0)),
          );
        }),
    );
    const id = store.startConversation();
    const pending = store.searchOutside(id, 'x');
    expect(store.getState().pendingAnswers[id]?.kind).toBe('external');
    store.cancelAnswer(id);
    await pending;
    expect(store.getState().conversations[0]?.messages.at(-1)?.kind).toBe('cancelled');
    expect(store.isAnswerPending(store.getState(), id)).toBe(false);
  });

  it('el pendiente nunca se guarda en el dispositivo', async () => {
    const storage = (await import('@react-native-async-storage/async-storage')).default;
    await signedIn();
    askUntilAborted();
    const id = store.startConversation();
    const pending = store.answerQuestion(id, 'x');
    const calls = vi.mocked(storage.setItem).mock.calls;
    const saved = calls.at(-1)?.[1] ?? '';
    expect(saved).not.toContain('pendingAnswers');
    store.cancelAnswer(id);
    await pending;
  });
});

describe('exportación de datos', () => {
  it('une lo del servidor con lo del dispositivo', async () => {
    await signedIn();
    const id = store.startConversation();
    api.ask.mockResolvedValueOnce({ status: 'abstained', message: 'nada' });
    await store.answerQuestion(id, 'una pregunta');
    const result = await store.exportAccountData();
    if (!result.ok) throw new Error('debía funcionar');
    const data = JSON.parse(result.json) as {
      servidor: unknown;
      dispositivo: { conversaciones: unknown[]; ajustes: unknown; progresoDeEstudio: unknown };
    };
    expect(data.servidor).toEqual({ profile: { id: 'u1' } });
    expect(data.dispositivo.conversaciones).toHaveLength(1);
    expect(data.dispositivo.ajustes).toBeDefined();
    expect(data.dispositivo.progresoDeEstudio).toBeDefined();
  });

  it('si el servidor falla, no entrega un archivo a medias', async () => {
    await signedIn();
    api.exportAccount.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    expect(await store.exportAccountData()).toEqual({ ok: false, error: 'NET_UNAVAILABLE' });
  });
});

describe('borrar la cuenta desde Perfil', () => {
  const google = {
    ...user('g2'),
    app_metadata: { provider: 'google', providers: ['google'] },
  };

  it('con contraseña incorrecta no borra nada', async () => {
    await signedIn();
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { status: 400, code: 'invalid_credentials' },
    });
    expect(await store.deleteAccountConfirmed('mala')).toBe('wrong_password');
    expect(api.deleteAccount).not.toHaveBeenCalled();
    expect(store.getState().session).not.toBeNull();
  });

  it('si no se pudo comprobar la contraseña, tampoco borra', async () => {
    await signedIn();
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { status: 0, code: undefined },
    });
    expect(await store.deleteAccountConfirmed('buena')).toBe('failed');
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('con la contraseña correcta comprueba con Supabase y luego borra', async () => {
    await signedIn();
    auth.signInWithPassword.mockClear();
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: user('u1') }, error: null });
    expect(await store.deleteAccountConfirmed('buena')).toBe('deleted');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'u1@correo.com',
      password: 'buena',
    });
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(store.getState().session).toBeNull();
  });

  it('una cuenta de Google no pide contraseña', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: google }, error: null });
    await store.signIn('g2@correo.com', 'x');
    await vi.waitFor(() => expect(store.getState().sync.loading).toBe(false));
    expect(store.getState().session?.hasPassword).toBe(false);
    auth.signInWithPassword.mockClear();
    expect(await store.deleteAccountConfirmed('')).toBe('deleted');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('una cuenta con correo y Google sí pide contraseña', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          ...user('m1'),
          app_metadata: { provider: 'google', providers: ['google', 'email'] },
        },
      },
      error: null,
    });
    await store.signIn('m1@correo.com', 'x');
    await vi.waitFor(() => expect(store.getState().sync.loading).toBe(false));
    expect(store.getState().session?.hasPassword).toBe(true);
  });
});

describe('lista de espera', () => {
  it('envía el correo al servidor y no lo guarda en el dispositivo', async () => {
    expect(await store.joinWaitlist(' tutor@correo.com ', true, 'web')).toBe('ok');
    expect(api.joinWaitlist).toHaveBeenCalledWith({
      email: 'tutor@correo.com',
      consent: true,
      source: 'web',
    });
    expect(JSON.stringify(store.getState())).not.toContain('tutor@correo.com');
  });

  it('sin consentimiento o con correo inválido no llama a la API', async () => {
    expect(await store.joinWaitlist('tutor@correo.com', false, 'app')).toBe('invalid');
    expect(await store.joinWaitlist('no-es-correo', true, 'app')).toBe('invalid');
    expect(api.joinWaitlist).not.toHaveBeenCalled();
  });

  it('traduce los errores del servidor', async () => {
    api.joinWaitlist.mockRejectedValueOnce(new FakeApiError('RATE_LIMITED', 429));
    expect(await store.joinWaitlist('a@correo.com', true, 'app')).toBe('limited');
    api.joinWaitlist.mockRejectedValueOnce(new FakeApiError('REQ_INVALID', 400));
    expect(await store.joinWaitlist('a@correo.com', true, 'app')).toBe('invalid');
    api.joinWaitlist.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    expect(await store.joinWaitlist('a@correo.com', true, 'app')).toBe('failed');
  });
});

describe('consentimientos', () => {
  it('registra Términos y Política con la versión vigente', async () => {
    const { LEGAL_VERSION } = await import('../src/i18n/legal');
    await signedIn();
    expect(await store.acceptLegalDocuments()).toEqual({ ok: true });
    expect(api.acceptConsent).toHaveBeenCalledTimes(2);
    expect(api.acceptConsent).toHaveBeenCalledWith('terms', LEGAL_VERSION);
    expect(api.acceptConsent).toHaveBeenCalledWith('privacy', LEGAL_VERSION);
  });

  it('si el servidor no lo registra, devuelve un código para mostrar y no avanza', async () => {
    await signedIn();
    api.acceptConsent.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    expect(await store.acceptLegalDocuments()).toEqual({ ok: false, error: 'NET_UNAVAILABLE' });
  });

  it('sin sesión no llama a la API', async () => {
    expect(await store.acceptLegalDocuments()).toMatchObject({ ok: false });
    expect(api.acceptConsent).not.toHaveBeenCalled();
  });

  it('quien no aceptó la versión vigente va a Privacidad, no a Inicio', async () => {
    api.consents.mockResolvedValueOnce({ consents: [] });
    await signedIn();
    expect(store.needsConsent(store.getState())).toBe(true);
    expect(store.entryRoute(store.getState())).toBe('/privacy');
    expect(await store.acceptLegalDocuments()).toEqual({ ok: true });
    expect(store.entryRoute(store.getState())).toBe('/home');
  });

  it('una versión anterior o un solo documento aceptado no bastan', async () => {
    api.consents.mockResolvedValueOnce({
      consents: [
        { document: 'terms', version: '2020-01-01', acceptedAt: '' },
        { document: 'privacy', version: LEGAL_VERSION, acceptedAt: '' },
      ],
    });
    await signedIn();
    expect(store.entryRoute(store.getState())).toBe('/privacy');
    expect(
      store.consentStatus([{ document: 'terms', version: LEGAL_VERSION, acceptedAt: '' }]),
    ).toBe('missing');
  });

  it('sin red no bloquea la entrada: muestra el error de sincronización', async () => {
    api.consents.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    await signedIn();
    expect(store.getState().consent).toBe('unknown');
    expect(store.getState().sync.error).toBe('NET_UNAVAILABLE');
    expect(store.entryRoute(store.getState())).toBe('/home');
  });

  it('si ya se sabe que no aceptó, un fallo de red posterior no lo deja pasar', async () => {
    api.consents.mockResolvedValueOnce({ consents: [] });
    await signedIn();
    api.consents.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    api.courses.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    await store.refreshAll();
    expect(store.getState().sync.error).toBe('NET_UNAVAILABLE');
    expect(store.entryRoute(store.getState())).toBe('/privacy');
  });

  it('otra cuenta en el mismo teléfono no hereda la aceptación de la anterior', async () => {
    await signedIn('u1');
    expect(store.getState().consent).toBe('accepted');
    await store.signOut();
    api.consents.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    await signedIn('u2');
    expect(store.getState().consent).toBe('unknown');
  });
});

describe('mayoría de edad', () => {
  it('se pide solo si hay sesión y la cuenta no la confirmó', async () => {
    expect(store.needsAdultCheck(store.getState())).toBe(false);
    expect(store.entryRoute(store.getState())).toBe('/login');
    await signedIn();
    expect(store.needsAdultCheck(store.getState())).toBe(false);
    expect(store.entryRoute(store.getState())).toBe('/home');
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: user('g1', 'Ana', false) },
      error: null,
    });
    await store.signIn('ana@gmail.com', 'secreta123');
    expect(store.needsAdultCheck(store.getState())).toBe(true);
    expect(store.entryRoute(store.getState())).toBe('/confirm-age');
  });

  it('mayor de 18: guarda solo adult_confirmed, nunca la fecha', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: user('g1', 'Ana', false) },
      error: null,
    });
    await store.signIn('ana@gmail.com', 'secreta123');
    expect(await store.confirmAdult('15/03/1999')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { adult_confirmed: true } });
    expect(JSON.stringify(auth.updateUser.mock.calls)).not.toContain('1999');
    expect(store.entryRoute(store.getState())).toBe('/home');
  });

  it('menor de 18: borra la cuenta que creó Google, sin guardar nada', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: user('g1', 'Ana', false) },
      error: null,
    });
    await store.signIn('ana@gmail.com', 'secreta123');
    const minor = new Date().getFullYear() - 15;
    expect(await store.confirmAdult(`01/01/${minor}`)).toEqual({ ok: false, error: 'AUTH_MINOR' });
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalled();
    expect(store.getState().session).toBeNull();
  });

  it('menor de 18: si el borrado falla, igual cierra la sesión', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: user('g1', 'Ana', false) },
      error: null,
    });
    await store.signIn('ana@gmail.com', 'secreta123');
    api.deleteAccount.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    const minor = new Date().getFullYear() - 15;
    expect(await store.confirmAdult(`01/01/${minor}`)).toEqual({ ok: false, error: 'AUTH_MINOR' });
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(store.getState().session).toBeNull();
  });

  it('fecha inválida → AUTH_BIRTHDATE_INVALID', async () => {
    await signedIn();
    expect(await store.confirmAdult('31/02/2000')).toEqual({
      ok: false,
      error: 'AUTH_BIRTHDATE_INVALID',
    });
  });
});

describe('Google y enlaces de la app', () => {
  it('la confirmación del registro vuelve a auth-callback, la misma URL que Google', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: null, session: null }, error: null });
    await store.signUp({
      fullName: 'Ana',
      email: 'ana@correo.com',
      password: 'secreta123',
      confirm: 'secreta123',
      birthDate: '15/03/1999',
    });
    const url = 'exp://192.168.1.20:8081/--/auth-callback';
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: url }) }),
    );
    expect(await store.resendSignupEmail('ana@correo.com')).toBe(true);
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'ana@correo.com',
      options: { emailRedirectTo: url },
    });
    // Al volver con el código del correo, la sesión se abre igual que con Google.
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: user('u9'), session: {} },
      error: null,
    });
    expect(await store.completeAuthCode('del-correo', null, 'AUTH_CALLBACK_FAILED')).toEqual({
      ok: true,
      next: '/home',
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('del-correo', undefined);
  });

  it('el enlace de recuperación vuelve a la pantalla de la app', async () => {
    expect(await store.requestPasswordReset(' ana@correo.com ')).toBe(true);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@correo.com', {
      redirectTo: 'exp://192.168.1.20:8081/--/reset-password',
    });
  });

  it('en el teléfono abre el navegador y cambia el código por la sesión una sola vez', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({
      data: { provider: 'google', url: 'https://x.supabase.co/auth/v1/authorize', flowId: 'f1' },
      error: null,
    });
    links.openAuthSession.mockResolvedValueOnce(
      'exp://192.168.1.20:8081/--/auth-callback?code=abc123',
    );
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: user('g1', 'Ana', false), session: {} },
      error: null,
    });
    const r = await store.signInWithGoogle();
    expect(r).toEqual({ ok: true, next: '/confirm-age' });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'exp://192.168.1.20:8081/--/auth-callback',
        skipBrowserRedirect: true,
      },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123', { flowId: 'f1' });
    // El mismo código llega también por el enlace a auth-callback: no se cambia otra vez.
    await store.completeAuthCode('abc123');
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('si la persona cierra el navegador, no muestra error', async () => {
    auth.signInWithOAuth.mockResolvedValueOnce({
      data: { provider: 'google', url: 'https://x.supabase.co/auth/v1/authorize' },
      error: null,
    });
    links.openAuthSession.mockResolvedValueOnce(null);
    expect(await store.signInWithGoogle()).toEqual({ ok: false, error: null });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un código vencido o de otro dispositivo → AUTH_LINK_EXPIRED', async () => {
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthPKCECodeVerifierMissingError', status: 400 },
    });
    expect(await store.completeAuthCode('viejo')).toEqual({
      ok: false,
      error: 'AUTH_LINK_EXPIRED',
    });
    expect(store.getState().session).toBeNull();
    // Un fallo (p. ej. sin red) no queda guardado: se puede reintentar con el mismo código.
    auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: user('u3'), session: {} },
      error: null,
    });
    expect(await store.completeAuthCode('viejo')).toMatchObject({ ok: true });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
  });
});

describe('nueva contraseña', () => {
  it('valida antes de llamar al servidor y la guarda con la sesión de recuperación', async () => {
    expect(await store.updatePassword('corta', 'corta')).toMatchObject({
      error: 'AUTH_WEAK_PASSWORD',
      field: 'password',
    });
    expect(await store.updatePassword('secreta123', 'secreta124')).toMatchObject({
      error: 'AUTH_PASSWORD_MISMATCH',
      field: 'confirm',
    });
    expect(await store.updatePassword('secreta123', 'secreta123')).toMatchObject({
      error: 'AUTH_LINK_EXPIRED',
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
    await signedIn();
    expect(await store.updatePassword('nueva12345', 'nueva12345')).toEqual({ ok: true });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nueva12345' });
    auth.updateUser.mockResolvedValueOnce({ error: { code: 'same_password', status: 422 } });
    expect(await store.updatePassword('nueva12345', 'nueva12345')).toMatchObject({
      error: 'AUTH_SAME_PASSWORD',
    });
  });
});

describe('panel de administración', () => {
  const adminUser = (id: string, email = `${id}@correo.com`) => ({
    id,
    email,
    createdAt: '2026-11-01T10:00:00.000Z',
    lastSignInAt: null,
    provider: 'email',
    documents: 2,
    storageBytes: 1024,
    questionsToday: 1,
    consentVersion: null,
  });
  const adminDoc = (id: string, status: 'pending' | 'processing' | 'completed' | 'failed') => ({
    id,
    userId: 'u9',
    title: `${id}.pdf`,
    sizeBytes: 2048,
    status,
    totalPages: 3,
    topicCount: 1,
    errorMessage: status === 'failed' ? 'UP_UNREADABLE' : null,
    createdAt: '2026-11-01T10:00:00.000Z',
  });

  it('isAdmin es true si GET /v1/admin/me responde 200', async () => {
    api.adminMe.mockResolvedValueOnce({ admin: true, email: 'u1@correo.com' });
    await signedIn();
    expect(store.getState().isAdmin).toBe(true);
    expect(store.getState().adminChecking).toBe(false);
  });

  it('isAdmin es false con 403 FORBIDDEN', async () => {
    await signedIn();
    expect(api.adminMe).toHaveBeenCalledTimes(1);
    expect(store.getState().isAdmin).toBe(false);
  });

  it('isAdmin es false si falla la red, y no pasa a otra cuenta', async () => {
    api.adminMe.mockResolvedValueOnce({ admin: true, email: 'u1@correo.com' });
    await signedIn('u1');
    expect(store.getState().isAdmin).toBe(true);
    api.adminMe.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    await signedIn('u2');
    expect(store.getState().isAdmin).toBe(false);
    expect(store.getState().adminChecking).toBe(false);
  });

  it('isAdmin nunca se guarda en el dispositivo', async () => {
    const storage = (await import('@react-native-async-storage/async-storage')).default;
    api.adminMe.mockResolvedValueOnce({ admin: true, email: 'u1@correo.com' });
    await signedIn();
    const calls = vi.mocked(storage.setItem).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, value] of calls) expect(value).not.toContain('isAdmin');
  });

  it('cerrar sesión quita el acceso al panel', async () => {
    api.adminMe.mockResolvedValueOnce({ admin: true, email: 'u1@correo.com' });
    await signedIn();
    await store.signOut();
    expect(store.getState().isAdmin).toBe(false);
  });

  it('pagina usuarios: la página 1 reemplaza y las siguientes se agregan sin repetir', async () => {
    api.adminUsers
      .mockResolvedValueOnce({ users: [adminUser('a'), adminUser('b')], page: 1, hasMore: true })
      .mockResolvedValueOnce({ users: [adminUser('b'), adminUser('c')], page: 2, hasMore: false });
    const first = await store.loadAdminUsers(1);
    const second = await store.loadAdminUsers(2);
    if (!first.ok || !second.ok) throw new Error('debía cargar');
    expect(api.adminUsers).toHaveBeenNthCalledWith(1, 1);
    expect(api.adminUsers).toHaveBeenNthCalledWith(2, 2);
    const merged = store.mergeAdminPage(first.data, second.data);
    expect(merged.items.map((u) => u.id)).toEqual(['a', 'b', 'c']);
    expect(merged).toMatchObject({ page: 2, hasMore: false });
    const again = store.mergeAdminPage(merged, { ...first.data, items: [adminUser('z')] });
    expect(again.items.map((u) => u.id)).toEqual(['z']);
  });

  it('filtra documentos por estado y "Todos" no manda filtro', async () => {
    api.adminDocuments.mockResolvedValue({ documents: [], page: 1, hasMore: false });
    await store.loadAdminDocuments('failed', 1);
    await store.loadAdminDocuments('all', 3);
    expect(api.adminDocuments).toHaveBeenNthCalledWith(1, 'failed', 1);
    expect(api.adminDocuments).toHaveBeenNthCalledWith(2, null, 3);
  });

  it('traduce errores: sin red → offline; 403 → forbidden y quita el acceso', async () => {
    api.adminMe.mockResolvedValueOnce({ admin: true, email: 'u1@correo.com' });
    await signedIn();
    api.adminAudit.mockRejectedValueOnce(new FakeApiError('NETWORK', 0));
    expect(await store.loadAdminAudit(1)).toEqual({ ok: false, error: 'offline' });
    expect(store.getState().isAdmin).toBe(true);
    api.adminStats.mockRejectedValueOnce(new FakeApiError('INTERNAL', 500));
    expect(await store.loadAdminStats()).toEqual({ ok: false, error: 'failed' });
    api.adminAudit.mockRejectedValueOnce(new FakeApiError('FORBIDDEN', 403));
    expect(await store.loadAdminAudit(1)).toEqual({ ok: false, error: 'forbidden' });
    expect(store.getState().isAdmin).toBe(false);
  });

  it('reintenta solo documentos fallidos y los marca en cola', async () => {
    expect(await store.retryAdminDocument(adminDoc('d1', 'completed'))).toEqual({
      ok: false,
      error: 'DOC_STATE',
    });
    expect(api.adminRetryDocument).not.toHaveBeenCalled();
    const failed = adminDoc('d2', 'failed');
    expect(await store.retryAdminDocument(failed)).toEqual({
      ok: true,
      data: { id: 'd2', status: 'pending' },
    });
    expect(api.adminRetryDocument).toHaveBeenCalledWith('d2');
    const list = store.markDocumentRetried(
      { items: [failed, adminDoc('d3', 'failed')], page: 1, hasMore: false },
      'd2',
    );
    expect(list.items.map((d) => [d.id, d.status, d.errorMessage])).toEqual([
      ['d2', 'pending', null],
      ['d3', 'failed', 'UP_UNREADABLE'],
    ]);
    api.adminRetryDocument.mockRejectedValueOnce(new FakeApiError('DOC_STATE', 409));
    expect(await store.retryAdminDocument(failed)).toEqual({ ok: false, error: 'DOC_STATE' });
  });

  it('borra otra cuenta solo con su correo escrito; nunca la propia', async () => {
    await signedIn('u1');
    const own = adminUser('u1');
    expect(store.isOwnAccount(own)).toBe(true);
    expect(await store.adminDeleteUser(own, store.deleteConfirmationText(own))).toEqual({
      ok: false,
      error: 'ADMIN_TARGET_IS_SELF',
    });
    const other = adminUser('u7', 'Beto@Correo.com');
    expect(store.deleteConfirmationMatches(other, 'otro@correo.com')).toBe(false);
    expect(store.deleteConfirmationMatches(other, '   ')).toBe(false);
    expect(await store.adminDeleteUser(other, 'otro@correo.com')).toMatchObject({ ok: false });
    expect(api.adminDeleteUser).not.toHaveBeenCalled();
    expect(await store.adminDeleteUser(other, ' beto@correo.com ')).toEqual({
      ok: true,
      data: null,
    });
    expect(api.adminDeleteUser).toHaveBeenCalledWith('u7');
    const list = store.withoutUser({ items: [own, other], page: 1, hasMore: false }, 'u7');
    expect(list.items.map((u) => u.id)).toEqual(['u1']);
    api.adminDeleteUser.mockRejectedValueOnce(new FakeApiError('ADMIN_TARGET_IS_SELF', 400));
    expect(await store.adminDeleteUser(other, store.deleteConfirmationText(other))).toEqual({
      ok: false,
      error: 'ADMIN_TARGET_IS_SELF',
    });
  });

  it('una cuenta sin correo se confirma con su id y no se confunde con la propia', async () => {
    await signedIn('u1');
    const noEmail = { ...adminUser('u9'), email: null };
    expect(store.isOwnAccount(noEmail)).toBe(false);
    expect(store.deleteConfirmationText(noEmail)).toBe('u9');
    expect(store.deleteConfirmationMatches(noEmail, ' U9 ')).toBe(true);
    expect(store.deleteConfirmationMatches(noEmail, '')).toBe(false);
  });
});

describe('lectura estable del estado (useStore)', () => {
  it('arreglos y objetos con el mismo contenido cuentan como iguales', () => {
    const doc = { id: 'd1' };
    expect(store.shallowEqual([doc], [doc])).toBe(true);
    expect(store.shallowEqual([], [])).toBe(true);
    expect(store.shallowEqual({ a: 1, b: doc }, { a: 1, b: doc })).toBe(true);
  });

  it('distingue contenido distinto', () => {
    expect(store.shallowEqual([{ id: 'd1' }], [{ id: 'd1' }])).toBe(false);
    expect(store.shallowEqual([1], [1, 2])).toBe(false);
    expect(store.shallowEqual([], {})).toBe(false);
    expect(store.shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(store.shallowEqual(null, {})).toBe(false);
  });
});
