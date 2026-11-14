/**
 * Worker de apuntor.com: aplica `decideRoute` sobre los archivos estáticos de `dist/`.
 * Configurado como `main` en `wrangler.jsonc`, con el binding `ASSETS` y `run_worker_first`
 * solo para las rutas que no son archivos de Expo.
 */
import { NOT_FOUND_FILE, decideRoute } from './routing';

/** Lo mínimo del binding de assets que usamos (evita depender de `@cloudflare/workers-types`). */
interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetsBinding;
}

const NOINDEX = 'noindex';

/** Petición equivalente hacia otro archivo de los assets, conservando método y cabeceras. */
function assetRequest(original: Request, path: string): Request {
  return new Request(new URL(path, original.url), {
    method: original.method,
    headers: original.headers,
  });
}

function withHeaders(response: Response, noindex: boolean, status?: number): Response {
  const headers = new Headers(response.headers);
  if (noindex) headers.set('X-Robots-Tag', NOINDEX);
  return new Response(response.body, {
    status: status ?? response.status,
    statusText: status === undefined ? response.statusText : '',
    headers,
  });
}

async function notFound(request: Request, env: Env): Promise<Response> {
  const page = await env.ASSETS.fetch(assetRequest(request, NOT_FOUND_FILE));
  if (page.status < 400) return withHeaders(page, true, 404);
  return new Response('No encontrado', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': NOINDEX },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Método no permitido', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const url = new URL(request.url);
    const decision = decideRoute({
      hostname: url.hostname,
      pathname: url.pathname,
      search: url.search,
    });

    switch (decision.kind) {
      case 'redirect':
        return new Response(null, {
          status: decision.status,
          headers: { Location: decision.location },
        });
      case 'file': {
        const response = await env.ASSETS.fetch(assetRequest(request, decision.path));
        return response.status < 400
          ? withHeaders(response, decision.noindex)
          : notFound(request, env);
      }
      case 'static': {
        const response = await env.ASSETS.fetch(request);
        return response.status === 404 ? notFound(request, env) : response;
      }
      case 'not-found':
        return notFound(request, env);
    }
  },
} satisfies { fetch(request: Request, env: Env): Promise<Response> };
