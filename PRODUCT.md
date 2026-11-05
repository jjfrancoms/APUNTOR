# Product

Verdad de producto para las skills de diseño (`impeccable`, `frontend-design`, `ui-ux-pro-max`).
Resume `README.md` y `docs/producto/mvp-ux.md`; si algo cambia allí, actualízalo aquí. Lo marcado
**Por confirmar** viene así de la especificación y no es una decisión cerrada.

## Platform

adaptive

## Stack

Expo SDK 58 / React Native 0.88 con Expo Router, una sola base para Android, iOS y web. Estilos
con `StyleSheet` y tokens de `app/src/theme/tokens.ts` vía `useTheme()`; íconos Feather; textos en
`app/src/i18n/` (español e inglés). Sin CSS, Tailwind ni librería de componentes externa.

## Users

- Estudiantes universitarios de Perú (también colegio y cursos libres) que estudian con sus
  propios apuntes: PDF, Word, PowerPoint y fotos del cuaderno.
- Usan la app en el celular entre clases y en la noche, y en la laptop para sesiones largas.
- Menores de 18: por ahora a lista de espera hasta tener autorización de tutores
  (**Por confirmar**, criterio legal).

## Product Purpose

Subir documentos, que se organicen solos (curso → clase → sección → tema) y estudiar con ellos:
preguntar a la mascota, hacer quizzes y repasar flashcards. Toda respuesta sale solo de los
documentos del usuario y cita la página; si no está, la app lo dice en vez de inventar.

## Positioning

“Tus apuntes. Tu mejor profesor.” No es un chat genérico: es honesto sobre lo que no sabe y
separa siempre lo propio (verde) de lo externo (violeta, con fuente).

## Operating Context

- Modo por superficie: **Operate** en la app (inicio, cursos, subida, chat, estudio, perfil);
  **Read** en ayuda, términos y resumen compartido; **Persuade** solo en planes y en la llamada
  a crear cuenta del resumen público.
- Pre-lanzamiento: hoy funciona con un backend simulado (`app/src/store/`); la API real
  reemplazará esas acciones sin cambiar las pantallas.

## Capabilities and Constraints

- Ingesta asíncrona; el usuario puede salir de la pantalla mientras se procesa.
- Límite de 50 MB por archivo, formatos PDF, Word, PowerPoint, texto y fotos (**Por confirmar**).
- Plan gratis: 500 MB y 20 preguntas al día; plan Estudiante S/ 14 al mes (cifras de ejemplo,
  **Por confirmar**).
- Errores con códigos estables (`AUTH_INVALID`, `UP_SIZE`…) cuyo texto vive en i18n.

## Brand Commitments

- Mascota Illari, una llama paciente y honesta, sin detalles andinos. Acompaña, no protagoniza.
- Verde petróleo `#1D7568` (material propio), violeta `#5B4FC7` solo para contexto externo,
  ámbar `#F2A93B` nunca como texto. Plus Jakarta Sans. Detalle completo en `DESIGN.md`.
- Tono: cercano, breve, sin culpar al usuario y siempre con una acción.

## Evidence on Hand

- Especificación UX del MVP (`docs/producto/mvp-ux.md`): mapa de pantallas, estados, textos.
- Diseños de pantallas compartidos por el equipo (no versionados en el repositorio).
- Prototipo navegable con datos de prueba (cuenta `ana@correo.com` / `apuntor123`).

## Product Principles

1. Solo tus documentos: sin fuente en tus apuntes, no hay respuesta.
2. Toda afirmación se puede verificar (cita por página).
3. Lo externo se etiqueta y se puede apagar en Perfil.
4. Privacidad primero: analítica anónima, documentos aislados por usuario.
5. Cada pantalla tiene estados de carga, vacío, error y sin conexión.

## Accessibility & Inclusion

- WCAG AA en claro y oscuro (probado en `tokens.ts`); áreas táctiles ≥ 44 px.
- Etiquetas y roles en todo control; íconos sin texto con `accessibilityLabel`.
- Respeta “reducir movimiento” y el tamaño de texto del sistema.
- Español (Perú) e inglés; los documentos del usuario no se traducen.
