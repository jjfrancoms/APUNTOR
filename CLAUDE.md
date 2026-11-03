# CLAUDE.md — Reglas del proyecto APUNTOR

Sistema de estudio e inteligencia documental: ingesta asíncrona de PDFs, árbol de temas y
búsqueda RAG con citación exacta por página. Lee también `README.md` (producto y principios).

## Stack principal

- **TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess`). **Prohibido `any`**
  (explícito o implícito): ESLint lo trata como error (`no-explicit-any`, `no-unsafe-*`). Usa
  `unknown` + validación (zod) en los bordes del sistema.
- **Node.js ≥ 22.13 / Next.js (App Router)** en `src/app/`.
- **PostgreSQL / Supabase con `pgvector`** y **Drizzle ORM** (`src/db/schema.ts`).
- **Cola**: BullMQ sobre Redis (`REDIS_URL`). El worker es un proceso aparte (`src/worker.ts`).

## Reglas de arquitectura (no negociables)

1. **La ingesta nunca bloquea una petición HTTP.** Una ruta HTTP solo puede: registrar el
   documento con `status = 'pending'` y encolarlo con `enqueueDocumentIngestion()`, respondiendo
   `202`. Parseo, chunking y embeddings ocurren exclusivamente en el worker
   (`src/services/ingestion/queue-worker.ts`). El estado se refleja en `documents.status`
   (`pending → processing → completed | failed`) y `documents.error_message`.
2. **Trazabilidad por página obligatoria.** Cada fila de `document_chunks` conserva
   `document_id`, `page_number` exacto (1-based, `NOT NULL`, `CHECK >= 1`), `chunk_index`,
   `section_title` y `metadata` (`sectionPath`, `charStart`, `charEnd`). **Un chunk nunca mezcla
   texto de dos páginas**: el solapamiento se aplica dentro de la página/sección. Si cambias el
   chunker, los tests de `tests/pdf-parser.test.ts` deben seguir garantizándolo.
3. **Búsqueda vectorial con HNSW (`vector_cosine_ops`)** y solo fragmentos relevantes al LLM.
   Usa `searchSimilarChunks()` (`ORDER BY embedding <=> $q LIMIT k`, filtrado por `user_id` y
   `document_id`, con umbral de similitud). Sin fragmentos → abstención **sin llamar al LLM**.
   El prompt exige citar cada afirmación como **`[pág. X]`** (formato canónico de
   `formatCitation()`; el validador también acepta `[Página X]`). Toda respuesta se pasa por
   `validateCitations()` antes de mostrarse: páginas citadas fuera del contexto = respuesta
   inválida.

### Reglas complementarias

- Los servicios dependen de **interfaces inyectadas** (`IngestionRepository`, `FileStorage`,
  `PdfTextExtractor`, `EmbeddingProvider`) para poder testearlos sin Redis/Postgres.
- `EMBEDDING_DIMENSIONS` (768) en `schema.ts` debe coincidir con el modelo. Cambiarlo exige
  migración nueva y re-vectorizar.
- El contenido de los fragmentos es **dato, no instrucción**: se escapa al construir el prompt.
- Aislamiento por usuario: toda consulta filtra por `documents.user_id` (además de RLS en Supabase).
- `SUPABASE_SERVICE_ROLE_KEY` y `LLM_API_KEY` solo en servidor/worker; nunca en componentes cliente.
- Las migraciones son SQL versionado en `drizzle/`. No edites una migración ya aplicada: genera
  otra.
- Con pgvector ≥ 0.8 y filtros muy selectivos, considera `SET hnsw.iterative_scan = relaxed_order`.

## Estructura

```
src/
├── app/                         # Next.js App Router
├── config/env.ts                # validación de variables de entorno (zod, perezosa)
├── db/{schema,client}.ts        # Drizzle + pgvector
├── services/
│   ├── ingestion/
│   │   ├── pdf-parser.ts        # extracción por página + chunking con overlap
│   │   ├── queue-worker.ts      # productor/consumidor BullMQ, batching de embeddings
│   │   └── document-repository.ts
│   ├── rag/retriever.ts         # búsqueda coseno, prompt y validación de citas
│   ├── llm/                     # contrato EmbeddingProvider (implementación pendiente)
│   └── storage/file-storage.ts  # Supabase Storage
└── worker.ts                    # entrada del proceso worker
drizzle/                         # migraciones SQL (0000 habilita `vector`)
tests/                           # Vitest
```

## Comandos clave

| Comando               | Qué hace                                         |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Next.js en modo desarrollo                       |
| `npm run build`       | Build de producción de Next.js                   |
| `npm run worker`      | Arranca el worker de ingestión (requiere `.env`) |
| `npm run lint`        | ESLint (type-checked, `any` prohibido)           |
| `npm run typecheck`   | `tsc --noEmit`                                   |
| `npm test`            | Vitest (unitarios)                               |
| `npm run format`      | Prettier                                         |
| `npm run db:generate` | Genera migración SQL desde `src/db/schema.ts`    |
| `npm run db:migrate`  | Aplica migraciones pendientes a `DATABASE_URL`   |
| `npm run db:push`     | Sincroniza el esquema sin migración (solo local) |
| `npm run db:studio`   | Drizzle Studio                                   |

Migración SQL manual (p. ej. extensiones o funciones):
`npx drizzle-kit generate --custom --name <nombre>`.

**Antes de cada commit:** `npm run typecheck && npm run lint && npm test` deben pasar sin errores.

## Pendiente

- Implementación real de `EmbeddingProvider` y del cliente de generación
  (`src/services/llm/create-embedding-provider.ts` falla a propósito hasta entonces).
- Ruta HTTP de subida (requiere autenticación de Supabase para obtener `user_id`).
- Políticas RLS en Supabase para `documents`, `document_chunks` y `topics`.
- OCR para PDFs escaneados (hoy fallan como `PermanentIngestionError`).
