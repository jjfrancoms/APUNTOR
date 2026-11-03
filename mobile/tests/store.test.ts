import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) },
}));

const store = await import('../src/store/store');
const { DEMO_EMAIL, DEMO_PASSWORD } = store;

beforeEach(() => store.resetDemo());

describe('sesión', () => {
  it('entra con la cuenta de prueba y rechaza contraseñas incorrectas (AUTH_INVALID)', () => {
    expect(store.signIn(DEMO_EMAIL, 'mala')).toEqual({
      ok: false,
      error: 'AUTH_INVALID',
      field: 'password',
    });
    expect(store.signIn(DEMO_EMAIL, DEMO_PASSWORD)).toEqual({ ok: true });
    expect(store.getState().session?.name).toBe('Ana');
  });

  it('registra cuentas nuevas y detecta correo repetido y contraseña corta', () => {
    expect(store.signUp('Ana', DEMO_EMAIL, '12345678')).toMatchObject({
      error: 'AUTH_EMAIL_TAKEN',
    });
    expect(store.signUp('Luis Pérez', 'luis@correo.com', '123')).toMatchObject({
      error: 'AUTH_WEAK_PASSWORD',
    });
    expect(store.signUp('Luis Pérez', 'luis@correo.com', '12345678')).toEqual({ ok: true });
    expect(store.getState().session).toMatchObject({ name: 'Luis', email: 'luis@correo.com' });
  });
});

describe('chat con citas por página', () => {
  it('responde con el fragmento propio y cita su página exacta', () => {
    const r = store.findAnswer('¿qué es un límite lateral por la derecha?');
    expect(r.kind).toBe('answer');
    if (r.kind === 'answer') expect(r.chunk.page).toBe(14);
  });

  it('se abstiene cuando la respuesta no está en los apuntes', () => {
    expect(store.findAnswer('¿Quién descubrió la penicilina?').kind).toBe('notFound');
  });

  it('no usa los documentos si el usuario lo desactivó', () => {
    store.updateSettings({ useDocs: false });
    const r = store.findAnswer('límite lateral por la derecha');
    if (r.kind === 'answer') expect(r.chunk.documentId).not.toBe('limites-continuidad');
  });

  it('el mensaje de respuesta incluye la fuente y el contexto externo solo si está activado', () => {
    const id = store.startConversation();
    store.askQuestion(id, 'definición de límite con épsilon y delta');
    store.answerQuestion(id, 'definición de límite con épsilon y delta');
    let last = store
      .getState()
      .conversations.find((c) => c.id === id)
      ?.messages.at(-1);
    expect(last?.sources?.[0]?.page).toBe(12);
    expect(last?.external?.host).toBe('es.wikipedia.org');
    store.updateSettings({ external: false });
    store.answerQuestion(id, 'definición de límite con épsilon y delta');
    last = store
      .getState()
      .conversations.find((c) => c.id === id)
      ?.messages.at(-1);
    expect(last?.external).toBeUndefined();
  });

  it('aplica el límite diario del plan gratis y no lo aplica en Estudiante', () => {
    const id = store.startConversation();
    for (let i = store.questionsToday(store.getState()); i < store.FREE_DAILY_QUESTIONS; i += 1)
      store.askQuestion(id, `pregunta ${i}`);
    expect(store.limitReached(store.getState())).toBe(true);
    expect(store.askQuestion(id, 'una más')).toBe(false);
    expect(
      store
        .getState()
        .conversations.find((c) => c.id === id)
        ?.messages.at(-1)?.kind,
    ).toBe('limit');
    store.choosePlan('student');
    expect(store.askQuestion(id, 'una más')).toBe(true);
  });
});

describe('subida e ingesta simulada', () => {
  it('valida formato, tamaño e idioma con los códigos de la especificación', () => {
    const jobs = store.enqueueUploads([
      { name: 'Examen final.rar', sizeMb: 3 },
      { name: 'Clase grabada.mp4', sizeMb: 212 },
      { name: 'Resumen_chino.pdf', sizeMb: 1 },
      { name: 'Clase grabada.pdf', sizeMb: 60 },
      { name: 'Derivadas de cálculo.pdf', sizeMb: 2 },
    ]);
    expect(jobs.map((j) => j.error ?? j.status)).toEqual([
      'UP_FORMAT',
      'UP_SIZE',
      'UP_LANGUAGE',
      'UP_SIZE',
      'uploading',
    ]);
  });

  it('rechaza por espacio lleno (UP_QUOTA)', () => {
    const [job] = store.enqueueUploads(
      [
        { name: 'a.pdf', sizeMb: 40 },
        ...Array.from({ length: 12 }, (_, i) => ({ name: `b${i}.pdf`, sizeMb: 40 })),
      ].slice(-1),
    );
    expect(job?.status).toBe('uploading');
    const many = store.enqueueUploads(
      Array.from({ length: 12 }, (_, i) => ({ name: `c${i}.pdf`, sizeMb: 45 })),
    );
    expect(many.some((j) => j.error === 'UP_QUOTA')).toBe(true);
  });

  it('sube, procesa, clasifica por el nombre y al confirmar crea el documento', () => {
    store.enqueueUploads([{ name: 'Límites de cálculo.pdf', sizeMb: 1 }]);
    for (let i = 0; i < 40; i += 1) store.tickUploads();
    const job = store.getState().uploads.find((u) => u.name === 'Límites de cálculo.pdf');
    expect(job).toMatchObject({ status: 'review', courseId: 'calculo-1', confident: true });
    const before = store.getState().documents.length;
    store.confirmUploads();
    expect(store.getState().documents.length).toBeGreaterThan(before);
    expect(store.getState().documents.some((d) => d.name === 'Límites de cálculo.pdf')).toBe(true);
  });

  it('los archivos sin curso claro quedan para revisión hasta elegir curso', () => {
    const pending = store.pendingReview(store.getState()).find((u) => !u.confident);
    expect(pending).toBeDefined();
    if (!pending) return;
    store.assignUploadCourse(pending.id, 'historia-peru');
    expect(store.getState().uploads.find((u) => u.id === pending.id)).toMatchObject({
      courseId: 'historia-peru',
      confident: true,
    });
  });
});

describe('documentos, cuenta y compartir', () => {
  it('eliminar un documento borra también sus fragmentos (ya no se cita)', () => {
    store.deleteDocument('limites-continuidad');
    expect(store.getState().chunks.some((c) => c.documentId === 'limites-continuidad')).toBe(false);
    const r = store.findAnswer('límite lateral por la derecha');
    if (r.kind === 'answer') expect(r.chunk.documentId).not.toBe('limites-continuidad');
  });

  it('dejar de compartir desactiva el enlace', () => {
    const token = store.createShare('definicion-limite', '30 días');
    store.stopSharing(token);
    expect(store.getState().shares.find((s) => s.token === token)?.active).toBe(false);
  });

  it('borrar la cuenta elimina la cuenta y la sesión', () => {
    store.signUp('Luis', 'luis@correo.com', '12345678');
    store.deleteAccount();
    expect(store.getState().session).toBeNull();
    expect(store.getState().accounts.some((a) => a.email === 'luis@correo.com')).toBe(false);
  });
});
