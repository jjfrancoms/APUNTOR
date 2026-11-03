# CLAUDE.md — Reglas del proyecto APUNTOR

Sistema de estudio e inteligencia documental: ingesta asíncrona de PDFs, árbol de temas y
búsqueda RAG con citación exacta por página. Lee también `README.md` (producto y principios) y
`docs/producto/mvp-ux.md` (alcance del MVP, mapa de 44 pantallas, estados por pantalla y textos de
error). Lo marcado **Por confirmar** en esa especificación no es una decisión cerrada.

## Stack principal

- **TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess`). **Prohibido `any`**
  (explícito o implícito): ESLint lo trata como error (`no-explicit-any`, `no-unsafe-*`). Usa
  `unknown` + validación (zod) en los bordes del sistema.
- **App cliente: Expo/React Native** (decisión cerrada del 30 oct 2026): una sola base para Android,
  iOS y web, con variantes móvil, tablet, escritorio y modo oscuro. Colores, breakpoints y tamaños
  táctiles salen de `src/design/tokens.ts`; no uses hex sueltos en las pantallas.
- **Backend: Node.js ≥ 22.13.** `src/app/` (Next.js) es provisional y solo sirve hoy como
  contenedor del servidor; la capa de UI va en la app Expo.
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
- Aislamiento por usuario: toda consulta filtra por `documents.user_id`, y además RLS
  (`drizzle/0002_enable_rls.sql`): `authenticated` solo puede leer lo suyo y borrar sus
  documentos; `anon` no ve nada; las escrituras las hace solo el backend/worker (dueño de las
  tablas). Toda tabla nueva con datos de usuario necesita RLS y su caso en `db/ci/rls-check.sql`.
- `SUPABASE_SERVICE_ROLE_KEY` y `LLM_API_KEY` solo en servidor/worker; nunca en componentes cliente.
- Las migraciones son SQL versionado en `drizzle/`. No edites una migración ya aplicada: genera
  otra.
- El árbol de temas (`topics`) se deriva de los encabezados (`sectionPath`) en el worker, tras los
  embeddings. `source_pages` solo contiene páginas donde realmente aparece el tema o sus subtemas.
  `summary` queda en `null` hasta que exista el cliente de generación.
- Con pgvector ≥ 0.8 y filtros muy selectivos, considera `SET hnsw.iterative_scan = relaxed_order`.

### Reglas de producto (de `docs/producto/mvp-ux.md`)

- Todo error visible al usuario se expresa con un **código estable** (`AUTH_INVALID`, `UP_FORMAT`,
  `UP_SIZE`…) que sirve de clave de traducción; el texto vive en la tabla de la especificación.
  Mensajes sin culpar al usuario y siempre con una acción. Nada de texto incrustado en imágenes.
- Material propio en verde, contexto externo en violeta y **siempre con fuente**; el usuario puede
  apagar el contexto externo en Perfil.
- Cada pantalla define sus estados cargando / vacío / error / sin conexión según la tabla de estados.
- Límite de subida de 50 MB (por confirmar) y formatos PDF, Word, PowerPoint, texto y fotos con OCR.

## Diseño y skills

- **`PRODUCT.md`** (raíz): usuarios, propósito, modo de cada superficie (Operate / Read /
  Persuade) y compromisos de marca, para las skills. Se mantiene al día con la especificación.
- **`DESIGN.md`** (raíz) es la identidad visual: paleta, tipografía, espacios, patrones y qué
  evitar. Manda sobre cualquier propuesta de una skill. Si cambias `src/design/tokens.ts`,
  actualiza `DESIGN.md` (lo verifica `tests/design-md.test.ts`).
- Skills de diseño en `.claude/skills/` (se cargan solas al trabajar en vistas; ver
  `.claude/skills/README.md`):
  - `frontend-design` (Anthropic): planificar el sistema y la dirección antes de codificar.
  - `impeccable` (pbakaus): `/impeccable critique`, `audit`, `polish`, `harden`… Para esta app
    usa las guías nativas (`audit.native.md`, `ios.md`, `android.md`).
  - `ui-ux-pro-max` (nextlevelbuilder): reglas de UX y accesibilidad; consulta el stack
    `react-native`, no los de Tailwind/shadcn.
- Las skills de terceros se copian tal cual (no se formatean ni se lintean) y no instalan hooks.
- Reglas que salieron de la auditoría con las skills (manténlas):
  - Todo lo tocable usa `Tap` (no `Pressable`): da respuesta al toque igual en toda la app.
  - `Screen` maneja el teclado (iOS) y `stickToBottom` mantiene visible lo último (chat).
  - Hojas y diálogos usan `useReducedMotion()` y el token `scrim` para el velo.
  - `TextLink` es un botón por defecto; `role="link"` solo para abrir documentos o páginas.
  - Sin etiquetas en mayúsculas sobre un título: las secciones llevan su encabezado normal.

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
│   ├── topics/topic-tree.ts     # árbol de temas desde sectionPath de los chunks
│   ├── llm/                     # contrato EmbeddingProvider (implementación pendiente)
│   └── storage/file-storage.ts  # Supabase Storage
└── worker.ts                    # entrada del proceso worker
drizzle/                         # migraciones SQL (0000 habilita `vector`)
mobile/                          # app Expo/React Native (Expo Router, SDK 58), paquete npm propio
├── src/app/                     # rutas: (auth)/ acceso, (tabs)/ navegación principal, documents/
├── src/components/ui/           # componentes base (Button, TextField, Card, Chip, Mascot…)
├── src/theme/                   # tema claro/oscuro desde src/design/tokens.ts (compartido)
├── src/i18n/es.ts               # todos los textos visibles (listos para traducir)
├── src/store/                   # backend simulado: estado, acciones y datos de prueba (seed.ts)
└── src/data/mock.ts             # contenido estático de ejemplo para las pantallas
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

App móvil (dentro de `mobile/`, con su propio `package.json`):

| Comando                  | Qué hace                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm start`              | Servidor de desarrollo de Expo (`w` abre la versión web)                                        |
| `npm run typecheck`      | `tsc --noEmit`                                                                                  |
| `npm test`               | Vitest (lógica de `src/lib`, datos y textos)                                                    |
| `npm run export:web`     | Build web estático; verifica que todas las rutas compilan                                       |
| `npx expo install <pkg>` | Instala dependencias compatibles con el SDK (`EXPO_OFFLINE=1` si la red bloquea la API de Expo) |

Datos de prueba: la app usa `mobile/src/store/` como backend simulado (persistido en el dispositivo)
con la misma semántica que tendrá la API: validación con códigos de error, ingesta asíncrona, respuestas
que solo citan fragmentos propios por página, límite diario y cuotas. Cuenta de prueba:
`ana@correo.com` / `apuntor123`. "Restablecer datos de prueba" (Perfil) vuelve al estado inicial. Al
conectar la API, se reemplazan las acciones del store; las pantallas no cambian.

Reglas de la app: cada pantalla indica su número del mapa (`/** Pantalla 6 · Inicio */`) y figura
en `mobile/src/data/screens.ts` (un test verifica que su ruta exista); los estados vacío/error/carga
se muestran con `?demo=<estado>` sobre la misma ruta; sin
texto literal fuera de `src/i18n/es.ts`; sin hex sueltos (usa `useTheme()`); el ámbar nunca es
color de texto (el tipo de `Text` lo impide); íconos sin texto llevan `accessibilityLabel`.

Migración SQL manual (p. ej. extensiones o funciones):
`npx drizzle-kit generate --custom --name <nombre>`.

**Antes de cada commit:** `npm run typecheck && npm run lint && npm test` deben pasar sin errores.

**CI** (`.github/workflows/ci.yml`, en cada PR y push a `main`): typecheck, lint, formato, tests y
build; además aplica las migraciones sobre Postgres 16 + pgvector (con `db/ci/supabase-shim.sql`
que simula roles y `auth.uid()`), verifica el índice HNSW, prueba el aislamiento RLS
(`db/ci/rls-check.sql`) y falla si `src/db/schema.ts` tiene cambios sin migración generada.

## Pendiente

- Implementación real de `EmbeddingProvider` y del cliente de generación
  (`src/services/llm/create-embedding-provider.ts` falla a propósito hasta entonces).
- Ruta HTTP de subida (requiere autenticación de Supabase para obtener `user_id`).
- Políticas de Supabase Storage para el bucket de PDFs (carpeta por `user_id`).
- OCR para PDFs escaneados (hoy fallan como `PermanentIngestionError`).
