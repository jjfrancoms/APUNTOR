import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'pk', apiUrl: 'http://api' },
  backendConfigured: true,
  PREVIEW: false,
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) },
  },
}));

const { api, ApiRequestError } = await import('../src/lib/api');
const study = await import('../src/lib/study');

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(status === 204 ? null : JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('llamadas de estudio', () => {
  it('genera un juego con el cuerpo y el token', async () => {
    const fetch = stubFetch(201, { set: { id: 's1' }, items: [] });
    await api.createStudySet({ documentId: 'd1', kind: 'quiz', count: 5 });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('http://api/v1/study/sets');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ documentId: 'd1', kind: 'quiz', count: 5 });
  });

  it('la generación se puede cancelar', async () => {
    stubFetch(201, {});
    const abort = new AbortController();
    abort.abort();
    await expect(
      api.createStudySet({ documentId: 'd1', kind: 'cards' }, { signal: abort.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('lista los juegos con filtros', async () => {
    const fetch = stubFetch(200, { sets: [] });
    await api.studySets({ documentId: 'd1', kind: 'cards' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/study/sets?documentId=d1&kind=cards');
    await api.studySets();
    expect(fetch.mock.calls[1]?.[0]).toBe('http://api/v1/study/sets');
  });

  it('envía resultado, repaso y borrado a su ruta', async () => {
    const fetch = stubFetch(200, { id: 'i1', box: 1, dueDate: '2026-11-09' });
    await api.saveStudyResult('s1', { score: 3, total: 5 });
    await api.reviewStudyItem('i1', true);
    await api.reviewToday();
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([
      'http://api/v1/study/sets/s1/results',
      'http://api/v1/study/items/i1/review',
      'http://api/v1/study/review/today',
    ]);
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toEqual({ known: true });
    stubFetch(204, null);
    await expect(api.deleteStudySet('s1')).resolves.toBeUndefined();
  });

  it('devuelve el código del servidor al fallar', async () => {
    stubFetch(429, { error: { code: 'STUDY_DAILY_LIMIT' } });
    const error = await api
      .createStudySet({ documentId: 'd1', kind: 'quiz' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(study.toStudyError(error)).toBe('STUDY_DAILY_LIMIT');
  });
});

describe('ayudas de estudio', () => {
  it('traduce cada código y los fallos de red', () => {
    for (const code of ['DOC_NOT_FOUND', 'DOC_STATE', 'STUDY_NO_CONTENT', 'STUDY_TOO_FEW_ITEMS']) {
      expect(study.toStudyError(new ApiRequestError(code, 422))).toBe(code);
    }
    expect(study.toStudyError(new ApiRequestError('RATE_LIMITED', 429))).toBe('RATE_LIMITED');
    expect(study.toStudyError(new ApiRequestError('NETWORK', 0))).toBe('NET');
    expect(study.toStudyError(new ApiRequestError('TIMEOUT', 0))).toBe('TIMEOUT');
    expect(study.toStudyError(new ApiRequestError('RARO', 500))).toBe('GENERIC');
    expect(study.toStudyError(new Error('x'))).toBe('GENERIC');
    expect(study.isCancelled(new ApiRequestError('CANCELLED', 0))).toBe(true);
  });

  it('calcula cupo, minutos y cantidades', () => {
    expect(study.generationsLeft(3, 10)).toBe(7);
    expect(study.generationsLeft(12, 10)).toBe(0);
    expect(study.estimateMinutes(5)).toBe(4);
    expect(study.estimateMinutes(1)).toBe(2);
    expect(study.clampCount(1)).toBe(3);
    expect(study.clampCount(99)).toBe(20);
  });

  it('muestra una pregunta como tarjeta y agrupa el repaso por curso', () => {
    const citation = { chunkId: 'c', documentId: 'd', pageNumber: 1, quote: '' };
    expect(
      study.cardFace({
        id: 'q',
        kind: 'quiz',
        citation,
        question: 'P',
        options: ['a', 'b', 'c', 'd'],
        correctIndex: 2,
        explanation: 'e',
      }),
    ).toEqual({ front: 'P', back: 'c' });
    const base = {
      kind: 'cards' as const,
      citation,
      front: 'f',
      back: 'b',
      setId: 's',
      documentTitle: 'D',
      box: 0,
      dueDate: '2026-11-08',
    };
    const rows = study.reviewByCourse([
      { ...base, id: '1', courseId: 'a', courseTitle: 'Cálculo' },
      { ...base, id: '2', courseId: null, courseTitle: null },
      { ...base, id: '3', courseId: 'a', courseTitle: 'Cálculo' },
    ]);
    expect(rows).toEqual([
      { course: 'Cálculo', cards: 2 },
      { course: null, cards: 1 },
    ]);
  });
});
