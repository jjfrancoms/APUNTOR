import type { FastifyServerOptions } from 'fastify';

/** Destino de los logs; las pruebas lo reemplazan para leer lo que se escribe. */
export interface LogStream {
  write(line: string): void;
}

/**
 * Opciones del logger de Fastify. Nunca se registra el cuerpo de las peticiones (contiene las
 * preguntas de los usuarios) ni la cabecera Authorization: de la petición solo quedan método,
 * ruta sin query e id. `redact` cubre además lo que se registre a mano con esos campos.
 */
export function loggerOptions(stream?: LogStream): NonNullable<FastifyServerOptions['logger']> {
  return {
    ...(stream === undefined ? {} : { stream }),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body',
        'headers.authorization',
        'headers.cookie',
        'body',
      ],
      censor: '[oculto]',
    },
    serializers: {
      req(request: { id: string; method: string; url: string }) {
        return { id: request.id, method: request.method, url: request.url.split('?')[0] };
      },
    },
  };
}
