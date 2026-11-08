import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/** fetch que no responde nunca; falla como el real cuando se aborta su señal. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      }),
  );
}

async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof ApiRequestError ? error.code : 'OTRO';
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('request: tiempo máximo y cancelación', () => {
  it('al vencer el tiempo falla con TIMEOUT y no deja temporizadores', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const result = codeOf(api.ask('x', { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe('TIMEOUT');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si quien llama aborta, falla con CANCELLED', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const result = codeOf(api.ask('x', { signal: controller.signal, timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    expect(await result).toBe('CANCELLED');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('una señal ya abortada no llega a llamar al servidor', async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    expect(await codeOf(api.external('x', { signal: controller.signal }))).toBe('CANCELLED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un fallo de red sigue siendo NETWORK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network request failed');
      }),
    );
    expect(await codeOf(api.ask('x', { timeoutMs: 1000 }))).toBe('NETWORK');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a tiempo responde normal y manda la señal y el token', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ status: 'small_talk', kind: 'greeting' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.ask('Hola', { timeoutMs: 1000 })).resolves.toEqual({
      status: 'small_talk',
      kind: 'greeting',
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('los códigos del servidor se conservan (RATE_LIMITED)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'RATE_LIMITED' } }), { status: 429 }),
      ),
    );
    const error = await api.ask('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });
});

describe('búsqueda y alcance de las preguntas', () => {
  function jsonFetch() {
    return vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify({ documents: [], topics: [], snippets: [] }))),
    );
  }

  it('search codifica la consulta', async () => {
    const fetchMock = jsonFetch();
    vi.stubGlobal('fetch', fetchMock);
    await api.search('límites & más');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `http://api/v1/search?q=${encodeURIComponent('límites & más')}`,
    );
  });
});
