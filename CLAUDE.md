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
  táctiles salen de `app/src/theme/tokens.ts`; no uses hex sueltos en las pantallas.
- **Backend: Node.js ≥ 22.13 con Fastify** (`api/`), desplegado en Railway.
- **PostgreSQL / Supabase con `pgvector`** y **Drizzle ORM** (`db/schema.ts`).
- **Cola**: pg-boss sobre Postgres (`QUEUE_DATABASE_URL`, conexión directa o de sesión). El worker
  es un proceso aparte (`worker/src/index.ts`).
- **Archivos**: Cloudflare R2 con URLs prefirmadas. **IA**: `gemini-embedding-2` (768 dims) y
  `gemini-2.5-flash` vía Vertex AI. Tres niveles de modelo (`resolveModels()`,
  `api/src/llm/models.ts`): **bajo** (`MODEL_LOW`) para tareas pequeñas (p. ej. clasificar un
  documento en un curso); **medio** (`MODEL_MEDIUM`) para el primer intento del chat, lo que el
  estudiante espera; **alto** (`MODEL_HIGH`) para lo que se hace una vez y se guarda (OCR,
  resúmenes) y para un único segundo intento del chat si la respuesta no pasa el validador o falla
  con un error no pasajero (`AnswerDeps.fallbackGenerator`; sigue siendo una pregunta de la cuota).
  `MODEL_FAST`/`MODEL_STRONG` siguen valiendo como nombres antiguos de medio/alto; `CHAT_MODEL` y
  `SUMMARY_MODEL` son ajustes más específicos. Todos valen `GENERATION_MODEL` si no se definen
  (bajo = medio). Razonamiento previo por nivel (`thinkingBudget`): bajo 512, medio 1024, alto sin
  tope; nunca 0 (el modelo lite lo rechaza con HTTP 400; `thinkingConfigFor()` lo omite).
  El resumen a demanda de la API, si el alto falla por saturación (`isTransientAiError`), se
  reintenta una vez con el medio sin cobrar dos veces; el worker no cae al medio. **Externo**: Tavily.
  Mientras no haya facturación, `GEMINI_API_KEY` (Google AI Studio, plan gratis) reemplaza a
  Vertex con los mismos modelos (`chooseGenAiBackend()`). Ese plan puede usar el contenido para
  mejorar productos de Google: solo pruebas propias, nunca apuntes de estudiantes reales.

## Reglas de arquitectura (no negociables)

1. **La ingesta nunca bloquea una petición HTTP.** Una ruta HTTP solo puede: registrar el
   documento con `status = 'pending'` y encolarlo con `enqueueDocumentIngestion()`, respondiendo
   `202`. Parseo, OCR, chunking y embeddings ocurren exclusivamente en el worker
   (`worker/src/ingestion/`). El estado se refleja en `documents.status`
   (`pending → processing → completed | failed`) y `documents.error_message`.
2. **Trazabilidad por página obligatoria.** Cada fila de `document_chunks` conserva
   `document_id`, `page_number` exacto (1-based, `NOT NULL`, `CHECK >= 1`), `chunk_index`,
   `section_title` y `metadata` (`sectionPath`, `charStart`, `charEnd`). **Un chunk nunca mezcla
   texto de dos páginas**: el solapamiento se aplica dentro de la página/sección. Si cambias el
   chunker, los tests de `tests/worker/pdf-parser.test.ts` deben seguir garantizándolo.
3. **Búsqueda vectorial con HNSW (`vector_cosine_ops`)** y solo fragmentos relevantes al LLM.
   Usa la función SQL `match_user_chunks` (umbral + top-K) mediante `createChunkSearch()`. Sin
   fragmentos → abstención **sin llamar al LLM**. El modelo responde en JSON con cita por afirmación
   y toda respuesta pasa por `validateAnswer()` (`api/src/rag/citations.ts`): id del fragmento, cita
   literal y coherencia con la afirmación. Un solo fallo = abstención. La página de la cita sale del
   fragmento, nunca del modelo; `[pág. X]` (`formatCitation()`) es solo el formato de presentación.

### Reglas complementarias

- Los servicios dependen de **interfaces inyectadas** (`IngestionRepository`, `FileStorage`,
  `PdfTextExtractor`, `EmbeddingProvider`) para poder testearlos sin Redis/Postgres.
- `EMBEDDING_DIMENSIONS` (768) en `schema.ts` debe coincidir con el modelo. Cambiarlo exige
  migración nueva y re-vectorizar.
- El contenido de los fragmentos es **dato, no instrucción**: se escapa al construir el prompt.
- Aislamiento por usuario: toda consulta filtra por `documents.user_id`, y además RLS
  (`db/migrations/0002_enable_rls.sql`): `authenticated` solo puede leer lo suyo y borrar sus
  documentos; `anon` no ve nada; las escrituras las hace solo el backend/worker (dueño de las
  tablas). Toda tabla nueva con datos de usuario necesita RLS y su caso en `db/ci/rls-check.sql`.
- Credenciales de R2, Vertex y Tavily solo en servidor/worker; nunca en la app.
- Las cuotas solo cambian con `consume_quota` y `release_quota` (atómicas), nunca con lectura +
  escritura.
- Las migraciones son SQL versionado en `db/migrations/`. No edites una migración ya aplicada: genera
  otra.
- El árbol de temas (`topics`) se deriva de los encabezados (`sectionPath`) en el worker, tras los
  embeddings. `source_pages` solo contiene páginas donde realmente aparece el tema o sus subtemas.
  `summary` queda en `null` hasta que exista el cliente de generación.
- `match_user_chunks` usa `hnsw.iterative_scan = relaxed_order`: requiere pgvector ≥ 0.8.
- **Títulos y temas** (`worker/src/ingestion/headings.ts`): primero por formato visual (tamaño
  de letra en PDF; tamaño, negrita, color y estilos en Word; título de diapositiva en PowerPoint),
  comparado con la letra "normal" del documento; si no hay formato, por texto, sin filas de
  tablas, fórmulas ni encabezados repetidos en cada página. Sin IA.
- **Formatos y topes de la ingesta** (`worker/src/ingestion/extractors.ts`): `.txt` y `.md` no
  tienen firma, así que se aceptan por extensión + UTF-8 válido; sus "páginas" son saltos de
  página (form feed) o tramos de ~3000 caracteres por párrafos, y `#` da los temas. En Word cada
  fila de tabla es una línea `| a | b |`. En PowerPoint las notas del orador van bajo "Notas:" en
  su diapositiva y una diapositiva sin texto pasa sus imágenes por OCR. **Topes de OCR por
  documento:** `MAX_OCR_PAGES` = 120 páginas escaneadas de PDF (si se pasa, error permanente sin
  gastar ninguna llamada) y `MAX_OCR_SLIDE_IMAGES` = 30 imágenes de diapositivas (las que sobran
  se omiten, sin fallar).
- **Reprocesar** un documento completado (panel o `npm run reprocess`, que gasta embeddings y
  OCR de nuevo): vuelve a `pending` y se encola; el worker regenera fragmentos, temas y páginas y
  borra `summaries/` antes de regenerarlos. Solo el panel deja rastro en `admin_audit`.
- **Archivos derivados** en R2, dentro de la carpeta del usuario (`derivedPrefix()`:
  `usuario/doc.pdf` → `usuario/doc/`): `pages.json` (texto normalizado por página, el mismo de
  los offsets `charStart/charEnd`) y `page-N.png` (página de PDF dibujada con
  `@napi-rs/canvas`). Los genera el worker sin bloquear la ingesta si fallan; se borran con el
  documento y con la cuenta (`deletePrefix`). Se ven solo con enlaces temporales.
- **Resumen de un tema** (`GET /v1/documents/:id/topics/:topicId/summary`, pantalla 63,
  `api/src/topic-summary.ts`): Gemini resume el tema SOLO con sus páginas (imagen + texto) y
  escribe Markdown (`summary-markdown.ts` lo lleva a bloques: título, párrafo, lista, tabla,
  fórmula con ">>", figura con caja 0–1000 que el servidor recorta de la página). Se descartan
  páginas que el modelo no vio y figuras de más de media página. Se genera una vez y se guarda
  en `usuario/doc/summaries/` (se borra con el documento). Tope `maxOutputTokens` (corta bucles).
  Modelo: `SUMMARY_MODEL` o el alto. El worker los genera de antemano tras marcar `completed`
  (`worker/src/ingestion/topic-summaries.ts`): temas raíz y hojas, máx. 40, uno por uno con
  `WORKER_AI_RETRY` y como mucho 20 min (menos que el vencimiento del trabajo); un fallo nunca
  cambia el estado del documento y lo que falte se genera al pedirlo. La app muestra cada parte
  con su página, que abre la página original para comprobarla.
- **Cuota y verificación de resúmenes:** generar un resumen desde la API cuesta 1 de la cuota
  diaria `summaries` (30 en el plan gratis; 429 `SUMMARY_DAILY_LIMIT`). Abrir uno guardado es
  gratis, si la generación falla se devuelve y el worker nunca cobra. La restricción
  `usage_quotas_kind_valid` debe admitir `summaries` antes de desplegar (`0013_thankful_stingray`).
  `verifySummaryBlocks()` (`api/src/summary-grounding.ts`) compara cada párrafo y cada punto de
  lista con las páginas que cita (palabras con contenido) y exige las fórmulas en esas páginas
  sin contar espacios: lo que falla se conserva, sin página y con `unverified: true`.
- El índice de temas de la app (`TopicOutline`) es desplegable: solo se ven los temas raíz y al
  tocar uno se muestran sus secciones (al cerrarlo se cierran también sus subtemas).
- `gemini-embedding-2` no admite `taskType`: la tarea va como prefijo en el texto
  (`formatEmbeddingInput()`).
- **Consentimientos con versión**: la tabla `consents` guarda documento (`terms`/`privacy`),
  versión y fecha, una fila por versión (`POST /v1/consents` es idempotente y responde 201;
  `GET /v1/consents` lista las del usuario; se borran con la cuenta en `deleteAllForUser`). La
  versión vigente es `LEGAL_VERSION` (fecha ISO) en `app/src/i18n/legal.ts`: cambiar el texto
  legal obliga a subirla y la app vuelve a pedir la aceptación (con sesión y sin la versión
  vigente aceptada, la entrada lleva a Privacidad (15), no a Inicio; sin red no bloquea).
- **Límite de peticiones** (`@fastify/rate-limit`): 300/min global y 20/min en
  `POST /v1/questions`, `/v1/external` y `/v1/documents`, por usuario con sesión o por IP sin
  ella; responde 429 `RATE_LIMITED`. Configurable con `AppDeps.rateLimit`. En Railway la API
  confía en un solo salto de proxy (`trustProxy: 1`): no uses `true`, porque deja inventar la
  IP con X-Forwarded-For.
- **Logs sin contenido** (`api/src/logging.ts`): de cada petición solo método, ruta sin query
  e id; nunca el cuerpo (preguntas, títulos) ni `Authorization`. Los errores 4xx de Fastify (JSON
  mal formado) responden `REQ_INVALID` y no se registran.
- **Conversaciones** (`api/src/conversations.ts`, rutas `/v1/conversations`; la app en
  `app/src/store/conversation-sync.ts`): la app genera los ids (UUID) y sube todo por una sola vía;
  `POST /v1/questions` no guarda nada. Crear y agregar son idempotentes por id, y solo el dueño
  las ve o las cambia (a otro usuario le responde 404). AsyncStorage es la copia local: el store compara con lo
  que el servidor ya confirmó y sube lo que falta, así que sin conexión se reintenta sin duplicar.
  Borrar gana: una conversación o mensaje borrado no vuelve al unir, y lo que ya se confirmó y
  falta en el servidor se quitó en otro dispositivo. Las respuestas en camino
  (`pendingAnswers`) nunca se suben. Se borran con la cuenta (`deleteAllForUser`), van en
  `GET /v1/account/export`, y el panel solo muestra conteos.
- **Clasificación** (`worker/src/ingestion/classification.ts`, `POST /v1/documents/:id/classification`,
  pantalla 16): tras la ingesta el worker sugiere un curso con el modelo bajo y deja
  `classification_status = 'suggested'`; nada se mueve hasta que la persona acepta, elige, crea o
  descarta. Las correcciones se guardan en `classification_corrections` y viajan al borrar la cuenta.
- **Estudio** (`api/src/study/`, rutas `/v1/study/*`): quizzes y tarjetas generados con cita
  literal validada; generar cuesta 1 de la cuota diaria `study_generations`. Las reglas Leitner
  son el módulo puro `app/src/lib/flashcards.ts` (sin imports: el servidor lo importa y el job
  raíz de CI no instala `app/`; no le agregues dependencias).
- Cabeceras de seguridad con `@fastify/helmet`.
- **Panel de administrador** (`api/src/admin.ts`, rutas `/v1/admin/*`): es admin quien tenga en
  el JWT un `email` incluido en `ADMIN_EMAILS` (separado por comas, sin distinguir mayúsculas)
  **y** además la Admin API de Supabase (`AuthUsersDirectory.get`, `createAdminGate()`) confirma
  que esa cuenta tiene el correo confirmado (`email_confirmed_at`) y que es ese mismo correo; el
  resultado se recuerda 5 min por usuario. Sin sesión 401, con sesión no admin 403 `FORBIDDEN`.
  **Privacidad (lo promete la política, sección 8):** el panel muestra nombres de archivo y
  metadatos (correo, fechas, tamaños, estados, conteos y el motivo de error de la ingesta);
  nunca el contenido de los documentos (fragmentos, títulos o resúmenes de temas), ni las
  preguntas o respuestas, ni los archivos o sus rutas (lo verifican `tests/api/app.test.ts` y
  `tests/db/admin.test.ts` con textos marcador). Rutas: `me`, `stats`, `users` (Admin API de
  Supabase vía `AppDeps.authUsers`, nunca SQL sobre `auth.users`), `documents` (filtro
  `status`), `POST documents/:id/retry` (solo fallidos → `pending` y se encola, 202),
  `POST documents/:id/reprocess` (solo completados → `pending` y se encola, 202; 409 `DOC_STATE`
  si no está completado o si su trabajo sigue activo generando resúmenes),
  `DELETE users/:id` (misma lógica que `DELETE /v1/account`, `deleteUserAccount()`; borrarse a
  sí mismo es 409 `ADMIN_TARGET_IS_SELF`) y `audit`. Listas con `page`/`perPage` (máx. 100) y
  `hasMore`. Toda acción que cambia algo se registra en `admin_audit` (RLS sin políticas: solo el
  backend). Usan el límite global de peticiones.

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
  evitar. Manda sobre cualquier propuesta de una skill. Si cambias `app/src/theme/tokens.ts`,
  actualiza `DESIGN.md` (lo verifica `app/tests/design-md.test.ts`).
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
api/src/
├── app.ts                # rutas Fastify (dependencias inyectadas)
├── index.ts              # entrada del proceso API
├── wiring.ts             # piezas reales compartidas con worker y eval
├── auth.ts               # verificación de JWT de Supabase (id y email)
├── admin.ts              # panel de administrador: consultas de metadatos y Admin API de Auth
├── account.ts            # borrado de cuenta compartido (usuario y panel)
├── documents.ts          # repositorio y reglas de subida
├── quota.ts              # cuotas atómicas
├── queue.ts              # productor pg-boss
├── rag/                  # retriever, citations (validador), answer (flujo completo)
├── llm/                  # EmbeddingProvider y Vertex AI (embeddings, generación, OCR)
├── storage/              # Cloudflare R2
└── external/tavily.ts    # contexto externo, siempre aparte de la respuesta
worker/src/
├── index.ts              # entrada del proceso worker
├── ingestion/            # extractors (PDF, DOCX, PPTX, fotos), chunking, pipeline, consumer
└── topics/topic-tree.ts  # árbol de temas desde sectionPath
db/
├── schema.ts, client.ts  # Drizzle + pgvector
├── migrations/           # SQL numerado
└── ci/                   # simulación de Supabase y verificación de RLS
eval/                     # arnés del criterio de lanzamiento (ver eval/README.md)
tests/                    # Vitest del backend; tests/db corre las migraciones en PGlite
app/                      # app Expo/React Native (Expo Router, SDK 58), paquete npm propio
├── src/app/              # rutas: (auth)/ acceso, (tabs)/ navegación principal, documents/
├── src/components/ui/    # componentes base (Button, TextField, Card, Chip, Mascot…)
├── src/theme/            # tokens.ts y tema claro/oscuro
├── src/i18n/es.ts        # todos los textos visibles (listos para traducir)
├── src/store/            # estado y acciones contra Supabase y la API (seed.ts: tipos y estado vacío)
└── src/data/mock.ts      # contenido estático de ejemplo para las pantallas
```

**Agentes:** antes de lanzar agentes, sigue `docs/agentes/orquestacion.md`: cada uno con su perfil de `.claude/agents/` según la dificultad y como máximo 2 a la vez.

## Comandos clave

| Comando               | Qué hace                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`         | API con recarga automática                                                                  |
| `npm run api`         | Arranca la API (requiere `.env`)                                                            |
| `npm run worker`      | Arranca el worker de ingesta (requiere `.env`)                                              |
| `npm run eval`        | Arnés de evaluación (ver `eval/README.md`)                                                  |
| `npm run reprocess`   | Reprocesa: `-- <documentId>` o `-- --all-completed`                                         |
| `npm run lint`        | ESLint (type-checked, `any` prohibido)                                                      |
| `npm run typecheck`   | `tsc --noEmit`                                                                              |
| `npm test`            | Vitest (unitarios)                                                                          |
| `npm run test:e2e`    | Pruebas de navegador (Playwright, servidor falso, `e2e/`)                                   |
| `npm run verificar`   | Todo en orden: tipos, lint, vitest (raíz y app) y `test:e2e`; se detiene en el primer fallo |
| `npm run format`      | Prettier                                                                                    |
| `npm run db:generate` | Genera migración SQL desde `db/schema.ts`                                                   |
| `npm run db:migrate`  | Aplica migraciones pendientes a `DATABASE_URL`                                              |
| `npm run db:push`     | Sincroniza el esquema sin migración (solo local)                                            |
| `npm run db:studio`   | Drizzle Studio                                                                              |

App móvil (dentro de `app/`, con su propio `package.json`):

| Comando                  | Qué hace                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm start`              | Servidor de desarrollo de Expo (`w` abre la versión web)                                        |
| `npm run typecheck`      | `tsc --noEmit`                                                                                  |
| `npm test`               | Vitest (lógica de `src/lib`, datos y textos)                                                    |
| `npm run export:web`     | Build web estático; verifica que todas las rutas compilan                                       |
| `npx expo install <pkg>` | Instala dependencias compatibles con el SDK (`EXPO_OFFLINE=1` si la red bloquea la API de Expo) |

Datos reales: `app/src/store/store.ts` habla con Supabase Auth (`lib/supabase.ts`) y con la API
(`lib/api.ts`). No hay cuenta ni datos de prueba. El dispositivo guarda ajustes, progreso de estudio y una
copia de las conversaciones del usuario que inició sesión. La app necesita `app/.env` (ver `app/.env.example`):
URL y clave publicable de Supabase, y la URL de la API (con Expo Go, la IP de la laptop en la red).

Fases: 1 (hecha) cuentas, cursos creados por el usuario, subida, preguntas con citas, cuotas y contexto
externo; 2 clasificación automática y conversaciones en el servidor; 3 quizzes, flashcards y resúmenes
compartidos; 4 pagos, notificaciones e inicio con Apple (Google ya está, tras una bandera). Las pantallas de fases pendientes
usan `previewOnly()` (`components/domain/PreviewOnly.tsx`): con datos de ejemplo solo en la vista previa
del diseño (`EXPO_PUBLIC_PREVIEW=1`, mapa en `/mapa`); en la app real muestran "Muy pronto". Hasta la
fase 2, cada documento hace de clase dentro de su curso.

Cuentas y acceso: solo mayores de 18 (los menores van a la lista de espera; no hay
consentimiento parental por ahora). El registro por correo guarda solo `adult_confirmed`; quien
entra con Google la confirma en la pantalla 58 y, si es menor, su cuenta se borra. El inicio con
Google está detrás de `EXPO_PUBLIC_GOOGLE_AUTH=1` (apagado hasta configurar el proveedor en
Supabase). Los enlaces del correo (confirmación del registro y recuperación) y el regreso de
Google usan PKCE y vuelven a la app: `auth-callback` (57) y `reset-password` (56); sus URLs
(`Linking.createURL`) deben estar en las Redirect URLs de Supabase.

Migraciones contra Supabase: usa la conexión directa o de sesión (`QUEUE_DATABASE_URL`), no la
del pooler de transacciones:
`sh -c 'set -a; . ./.env; set +a; DATABASE_URL="$QUEUE_DATABASE_URL" npx drizzle-kit migrate'`.

Reglas de la app: cada pantalla indica su número del mapa (`/** Pantalla 6 · Inicio */`) y figura
en `app/src/data/screens.ts` (un test verifica que su ruta exista); los estados vacío/error/carga
se muestran con `?demo=<estado>` sobre la misma ruta; sin
texto literal fuera de `src/i18n/es.ts`; sin hex sueltos (usa `useTheme()`); el ámbar nunca es
color de texto (el tipo de `Text` lo impide); íconos sin texto llevan `accessibilityLabel`.

Migración SQL manual (p. ej. extensiones o funciones):
`npx drizzle-kit generate --custom --name <nombre>`.

**Antes de cada commit:** `npm run typecheck && npm run lint && npm test` deben pasar sin errores.

**CI** (`.github/workflows/ci.yml`, en cada PR y push a `main`): typecheck, lint, formato y tests;
además aplica las migraciones sobre Postgres 16 + pgvector (con `db/ci/supabase-shim.sql`
que simula roles y `auth.uid()`), verifica el índice HNSW, prueba el aislamiento RLS
(`db/ci/rls-check.sql`) y falla si `db/schema.ts` tiene cambios sin migración generada.

## Pendiente

- Fases 2 y 3 hechas en código (clasificación con confirmación, conversaciones en el servidor,
  quizzes, flashcards y repaso con cita). Migraciones `0016_common_blizzard` (tablas y columnas
  nuevas; el CHECK de `usage_quotas` admite `study_generations`), `0017_clasificacion_rls`
  (documentos que ya tenían curso pasan a `confirmed`; RLS de `classification_corrections`),
  `0018_estudio_rls` y `0019_conversaciones_rls` escritas pero **sin aplicar** en Supabase.
  Orden: 0016, 0017, 0018, 0019, y **antes de desplegar la API** (sin ellas fallan la subida, el
  chat con conversaciones y el estudio). Va después de 0013 a 0015.
- Fase 4: suscripciones (RevenueCat y Stripe/Culqi), notificaciones e inicio con Apple.
- Migraciones `0009_consents` y `0010_consents_rls` (tabla `consents` con RLS) escritas pero
  **sin aplicar** en Supabase.
- Migraciones `0011_admin_audit` y `0012_admin_audit_rls` escritas pero **sin aplicar** en
  Supabase; falta definir `ADMIN_EMAILS` en Railway. El admin necesita el correo confirmado en
  Supabase (se comprueba con la Admin API); mantener activada la confirmación de correo.
- Migraciones `0013_thankful_stingray` (tabla `waitlist` + restricción `usage_quotas_kind_valid`
  con `summaries`), `0014_waitlist_rls` (RLS de `waitlist`) y `0015_search_fts_index` (índice de
  texto completo de la búsqueda) escritas pero **sin aplicar** en Supabase. Orden: 0013, 0014,
  0015, y **antes de desplegar la API** (sin 0013 los resúmenes nuevos y la lista de espera fallan).
- Lista de espera de menores (44): el correo ya viaja al servidor (`POST /v1/waitlist`) y no se
  queda en el dispositivo; falta que alguien reciba el aviso cuando haya plan para menores.
- Cuentas escolares `student_restricted`: las reglas siguen por definir.
- Animación Rive de 7 estados de la mascota.
- Los 200 casos reales de `eval/` y la prueba con 20 documentos reales.
