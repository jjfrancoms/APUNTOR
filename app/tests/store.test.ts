import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  updateUser: vi.fn(async () => ({ error: null })),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  resend: vi.fn(async () => ({ error: null })),
};
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

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
  deleteDocument: vi.fn(async () => undefined),
  deleteAccount: vi.fn(async () => undefined),
  ask: vi.fn(),
  external: vi.fn(),
};
vi.mock('@/lib/api', () => ({
  api,
  ApiRequestError: FakeApiError,
  toErrorCode: (error: unknown, fallback: string) =>
    error instanceof FakeApiError && error.code.startsWith('UP_') ? error.code : fallback,
}));

function doc(over: { id: string; courseId: string | null; title: string; topicCount: number }) {
  return {
    sizeBytes: 2 * 1024 * 1024,
    status: 'completed' as const,
    totalPages: 12,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

const user = (id: string, name = 'Ana Torres') => ({
  id,
  email: `${id}@correo.com`,
  user_metadata: { full_name: name, level: 'university' },
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

  it('al confirmar guarda cada archivo en su curso', async () => {
    vi.useFakeTimers();
    await signedIn();
    api.document.mockResolvedValue({ status: 'completed' });
    const [job] = store.enqueueUploads([file('a.pdf', 1)]);
    await vi.advanceTimersByTimeAsync(3500);
    store.assignUploadCourse(job?.id ?? '', 'c1');
    vi.useRealTimers();
    expect(await store.confirmUploads()).toBe(1);
    expect(api.updateDocument).toHaveBeenCalledWith('srv-1', { courseId: 'c1' });
  });
});

describe('chat', () => {
  it('muestra cada afirmación con su página y enlaza al documento', async () => {
    await signedIn();
    api.ask.mockResolvedValueOnce({
      status: 'answered',
      claims: [
        {
          text: 'El límite describe el valor al que se acerca f(x).',
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
      text: 'El límite describe el valor al que se acerca f(x). [pág. 12]',
      sources: [{ page: 12, documentId: 'd1' }],
    });
    expect(store.getState().conversations[0]?.course).toBe('Cálculo I');
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
