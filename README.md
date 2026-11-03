APUNTOR

Tus apuntes. Tu mejor profesor.

APUNTOR es una app de estudio donde subes tus propios documentos (PDF, PPTX, DOCX o fotos de tu cuaderno) y un asistente responde solo con lo que hay en ellos, citando la página de origen.

La mascota es Illari, una llama paciente y honesta: si tus apuntes no contienen la respuesta, te lo dice en vez de inventarla.

Estado: pre-lanzamiento. La especificación técnica v2.4 está congelada y el proyecto se encuentra en fase de validación del prototipo de recuperación. Todavía no hay una versión usable.

Qué hace
Organización automática. Cada documento se clasifica en curso → clase → sección → tema. Si la clasificación es dudosa, el usuario la confirma.
Respuestas ancladas a tus documentos. El asistente responde únicamente con fragmentos recuperados de lo que subiste, con cita de página.
Contexto externo separado. Si se consulta internet, ese contenido se muestra aparte, en color violeta, para que nunca se confunda con tus apuntes.
Cuentas escolares. Los colegios pueden usar la app con cuentas student_restricted (solo estudio). Las reglas exactas todavía están por definir.
Principios de diseño
Solo tus documentos. Sin fuente en tus apuntes, no hay respuesta.
Toda afirmación se puede verificar. Cada cita se valida contra el fragmento recuperado (id del fragmento, cita literal y coherencia con la afirmación).
Lo externo se etiqueta. Contenido de internet siempre visible como tal.
Privacidad primero. Analítica anónima, consentimiento parental para menores y documentos aislados por usuario mediante RLS.
Medir antes de construir. El lanzamiento depende de un conjunto de pruebas, no de una impresión.
Arquitectura (resumen de la especificación v2.4)
Capa	Tecnología
App móvil y web	Expo (React Native), un solo código base
Backend y workers	Node.js + TypeScript (Fastify), desplegado en Railway
Base de datos	Supabase Postgres con pgvector (índice HNSW) y RLS
Cola de trabajos	pg-boss
Archivos	Cloudflare R2 con URLs prefirmadas
Embeddings	gemini-embedding-2 (768 dimensiones)
Generación	gemini-2.5-flash vía Vertex AI
Búsqueda externa	Tavily
Suscripciones	RevenueCat (tiendas) y Stripe/Culqi (web)
Mascota	Rive, 7 estados

Flujo de una pregunta

pregunta → embedding → match_user_chunks (umbral + top-K)
        → si no hay coincidencias: se abstiene sin llamar al LLM
        → LLM responde en JSON con cita por afirmación
        → validador de citas → respuesta o "no encontré esto en tus apuntes"

Algunos datos del stack aún no están verificados (precios por modelo, disponibilidad de modelos por región, retención cero en Vertex AI). Consulta la sección Pendientes.

Criterio de lanzamiento

La app no sale hasta superar este conjunto de 200 casos:

Tipo	Casos	Umbral
Respondibles (calificados por una persona)	80	≥ 90 % correctos
Ausentes (la respuesta no está en los documentos)	100	0 fallos (límite superior ≈ 3,6 % con Clopper-Pearson)
Inyección de instrucciones	20	100 % bloqueados
Hoja de ruta
 Branding v1.0 (nombre, mascota, paleta, tono)
 Especificación técnica v2.4 (congelada)
 Migración de cuotas atómicas y correcciones señaladas en la revisión
 Script de ingesta (parseo, OCR, chunking, embeddings)
 Arnés de evaluación con casos etiquetados
 Prueba de recuperación con 20 documentos reales
 Recalcular márgenes con costos medidos
 Diseño de pantallas en Figma (faltan 10 vistas)
 Piloto con usuarios individuales
 Reglas y piloto para colegios
Marca
Elemento	Valor
Nombre	APUNTOR
Lema	Tus apuntes. Tu mejor profesor.
Mascota	Illari (llama, sin detalles andinos)
Verde petróleo	
#1D7568
Violeta (solo contexto externo)	
#5B4FC7
Ámbar (nunca para texto)	
#F2A93B
Fondo	
#FAF9F6
Texto	
#1C1C1E
Tipografía del logotipo	Plus Jakarta Sans
Estructura propuesta del repositorio
apuntor/
├── app/            # Expo (móvil y web)
├── api/            # Fastify + TypeScript
├── worker/         # ingesta, OCR, embeddings (pg-boss)
├── db/
│   └── migrations/ # SQL numerado (0001_..., 0002_...)
├── eval/           # arnés y casos de evaluación
└── docs/           # especificación, marca, decisiones
Requisitos de desarrollo
Node.js 22.13+ o 24.3+ (no se admiten versiones impares como 23 o 25)
Expo SDK 58 (React Native 0.88)
Proyecto de Supabase, proyecto de Google Cloud con Vertex AI y bucket de Cloudflare R2
bash
git clone <url-del-repositorio>
cd apuntor
cp .env.example .env   # completa las variables
npm install

Los comandos de ejecución se añadirán cuando existan los paquetes app, api y worker.

Pendientes y riesgos abiertos
Retención cero en Vertex AI: requiere configuración (caching duradero apagado, logging de solicitudes apagado) y confirmación escrita de Google. No se declara hasta tenerla.
Costos: los precios y el consumo real de tokens (incluidos los de razonamiento) están por medir.
Marco legal (Ley 29733): consentimiento de menores, edad mínima y registro de bancos de datos requieren revisión de un abogado.
Nombre: falta validar disponibilidad en tiendas, dominios, redes e INDECOPI (clases 9, 41 y 42).
Cuentas escolares: quién contrata, roles y alcance de "solo estudio".
Licencia

Por definir.
