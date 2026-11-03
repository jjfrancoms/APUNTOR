# APUNTOR — Especificación UX del MVP

Transcripción de la especificación de diseño (alcance, navegación, estados y textos de error).
Es la referencia para pantallas, estados y mensajes. Lo marcado **Por confirmar** puede cambiar
el diseño o el costo si se decide distinto: no lo trates como decisión cerrada.

## 1. Alcance y supuestos del MVP

| Tema                        | Supuesto                                                                                                                                           | Estado        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Plataformas                 | Android, iOS y web desde una sola base responsive (recomendado: Expo/React Native o Flutter). Vistas en 390 px y 1440 px; tablet 768 px pendiente. | Por confirmar |
| Documentos aceptados        | PDF, Word, PowerPoint y texto, más OCR de fotos y escaneos. Español e inglés. Máximo 50 MB. Sin video, audio ni archivos comprimidos.              | Por confirmar |
| Cuotas del plan gratis      | 500 MB de documentos y 20 preguntas al día. Cifras de ejemplo.                                                                                     | Por confirmar |
| Material propio vs. externo | Lo propio va en verde, lo externo en violeta y siempre con fuente. El contexto externo se puede apagar en Perfil.                                  | Decidido      |
| Menores de edad             | Se lanza para universidad y colegio a la vez, pero quien declare ser menor de 18 entra a lista de espera (pantalla 44) hasta tener criterio legal. | Por confirmar |
| Idioma                      | Español (Perú). Textos listos para traducir; sin textos incrustados en imágenes.                                                                   | Decidido      |
| Mascota                     | MVP con mascota 2D animada (Rive) y 7 estados. El modelo 3D queda para una fase posterior. El modo ligero reduce las animaciones.                  | Por confirmar |
| Cumplimiento                | Tratamiento de datos personales (Ley 29733), derechos de autor del contenido subido y consentimiento explícito. Requiere revisión legal.           | Por confirmar |

## 2. Mapa de navegación

Cada número es una pantalla de la página Móvil. En escritorio las rutas son las mismas; la barra
lateral reemplaza a la barra inferior.

| Flujo                    | Recorrido                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Cuenta nueva             | 1 Inicio de sesión → 11 Registro → 15 Privacidad → 14 Onboarding → 6 Inicio                    |
| Recuperar acceso         | 1 Inicio de sesión → 12 Recuperar contraseña → 13 Enlace enviado → 1 Inicio de sesión          |
| Subir documentos         | 2 Subir documentos → 17 Subiendo → 16 Revisar clasificación → 3 Cursos y temas                 |
| Subida con fallos        | 17 Subiendo → 18 Subida con problemas → 2 Subir documentos (reintentar)                        |
| Estudiar                 | 3 Cursos y temas → 20 Detalle de curso → 4 Tema con contexto externo → 21 Quiz → 22 Flashcards |
| Gestionar un documento   | 20 Detalle de curso → 19 Detalle de documento → 27 Confirmar eliminación → 3 Cursos y temas    |
| Chat                     | 5 Chat → 24 Respondiendo → 25 Error o límite → 26 Planes                                       |
| Historial y sin conexión | 5 Chat → 23 Conversaciones → 10 Chat sin conexión                                              |
| Ajustes                  | 7 Perfil y ajustes → 15 Privacidad → 26 Planes                                                 |
| Subir con foto (OCR)     | 2 Subir documentos → 28 Escanear apunte → 29 Lectura poco clara → 17 Subiendo                  |
| Idioma no compatible     | 17 Subiendo → 41 Idioma no compatible → 2 Subir documentos                                     |
| Chat fuera de documentos | 5 Chat → 30 Fuera de tus documentos                                                            |
| Quiz y repaso            | 6 Inicio → 32 Repaso del día → 22 Flashcards                                                   |
| Quiz con configuración   | 20 Detalle de curso → 31 Configurar quiz → 21 Quiz                                             |
| Compartir                | 4 Tema → 35 Compartir resumen → 36 Enlace creado → 37 Resumen público (web)                    |
| Suscripción              | 7 Perfil → 38 Gestionar suscripción → 26 Planes                                                |
| Notificaciones           | 14 Onboarding → 33 Permiso → 34 Ajustes de notificaciones                                      |
| Búsqueda y ayuda         | 3 Cursos → 39 Resultados → 42 Centro de ayuda → 43 Contactar soporte                           |
| Borrar cuenta y menores  | 7 Perfil → 40 Borrar cuenta → 15 Privacidad → 44 Lista de espera                               |

## 3. Estados por pantalla

Qué debe pasar cuando algo no es el camino feliz. "Ref." apunta a la pantalla diseñada; los casos
sin referencia se resuelven con el componente descrito.

| Pantalla                  | Cargando                                                | Vacío                                                                           | Error                                                                                       | Sin conexión                                       | Ref.             |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| Inicio de sesión          | Spinner en el botón; campos deshabilitados              | —                                                                               | "Correo o contraseña incorrectos." bajo el campo                                            | Aviso superior; no envía                           | 1                |
| Registro                  | Spinner en el botón                                     | —                                                                               | Correo ya registrado o contraseña corta, en línea bajo el campo                             | Aviso superior; no envía                           | 11               |
| Subir documentos          | Fila con barra de progreso por archivo                  | Zona de arrastre y botón "Elegir archivos"                                      | Fila en rojo con motivo y acción                                                            | Cola local; reanuda al volver la red               | 2 · 17 · 18      |
| Cursos y temas            | Esqueleto de 3 tarjetas                                 | "Aún no tienes cursos" con botón Subir                                          | "No pudimos cargar tus cursos." + Reintentar                                                | Muestra lo guardado y banner "Sin conexión"        | 3 · 8 · 20       |
| Detalle de documento      | Esqueleto del visor                                     | —                                                                               | "No pudimos abrir el archivo." + Reintentar                                                 | Metadatos sí; vista previa no                      | 19               |
| Tema con contexto externo | Lo propio carga primero; el bloque externo carga aparte | "No encontramos fuentes externas para este tema."                               | Bloque externo: "Fuente no disponible"; lo propio sigue visible                             | Solo material propio, con chip "Externo · sin red" | 4 · 10           |
| Chat                      | Burbuja con líneas de carga y botón Detener             | Sugerencias iniciales                                                           | Burbuja de error + Reintentar; límite diario lleva a Planes                                 | El mensaje se guarda y se envía al volver          | 5 · 24 · 25 · 10 |
| Quiz y flashcards         | Esqueleto de tarjeta                                    | "Sube al menos un tema para generar un quiz."                                   | "No pudimos generar el quiz." + Reintentar                                                  | Disponibles los ya generados; nuevos no            | 21 · 22          |
| Planes                    | Esqueleto de tarjetas                                   | —                                                                               | "No se pudo procesar el pago." + probar otro método                                         | Compra deshabilitada con aviso                     | 26               |
| Perfil y ajustes          | —                                                       | —                                                                               | Toast "No se guardó el cambio." con Reintentar                                              | Cambios en cola; se aplican al volver              | 7                |
| Escanear apunte (OCR)     | Visor de cámara; "Procesando página…"                   | Sin permiso de cámara: pedir permiso o elegir de la galería                     | Foto borrosa: "Algunas partes no se leyeron bien" (29)                                      | Se guarda la foto y se procesa al volver la red    | 28 · 29          |
| Resultados de búsqueda    | Esqueleto de 3 resultados                               | "No encontramos nada para 'texto'." con sugerencia de buscar con otras palabras | "No pudimos buscar." + Reintentar                                                           | Busca solo en lo ya guardado en el dispositivo     | 39               |
| Quiz: configuración       | —                                                       | Sin temas: "Sube al menos un tema para generar un quiz."                        | "No pudimos generar el quiz." + Reintentar                                                  | Deshabilitado; solo los quiz ya generados          | 31               |
| Repaso del día            | Esqueleto del resumen                                   | "Hoy no tienes tarjetas. Vuelve mañana."                                        | "No pudimos cargar tu repaso." + Reintentar                                                 | Usa las tarjetas descargadas; sincroniza al volver | 32               |
| Compartir resumen         | Botón "Creando enlace…"                                 | —                                                                               | No se pudo crear el enlace; el resumen caducado muestra "Este enlace ya no está disponible" | Compartir deshabilitado                            | 35 · 36 · 37     |
| Gestionar suscripción     | Esqueleto del plan                                      | Sin plan: mostrar Planes (26)                                                   | "No pudimos restaurar tus compras." + Reintentar                                            | Muestra el último estado conocido                  | 38               |
| Borrar cuenta             | Botón "Borrando…"; no se puede cancelar                 | —                                                                               | Texto de confirmación incorrecto: el botón sigue deshabilitado                              | No permite borrar sin conexión                     | 40               |
| Ayuda y contacto          | Esqueleto de la lista                                   | Búsqueda sin resultados: ofrecer "Contactar soporte"                            | No se envió el mensaje: conserva el texto y reintenta                                       | El mensaje queda en cola y se envía al volver      | 42 · 43          |
| Notificaciones            | —                                                       | —                                                                               | Permiso denegado: aviso con "Abrir ajustes del teléfono"                                    | —                                                  | 33 · 34          |

## 4. Textos de error y validaciones

Mensajes en español, sin culpar al usuario y con una acción clara. El código sirve como clave de
traducción.

| Código               | Pantalla | Mensaje                                                   | Acción                             | Tono  |
| -------------------- | -------- | --------------------------------------------------------- | ---------------------------------- | ----- |
| `AUTH_INVALID`       | 1        | Correo o contraseña incorrectos.                          | Enlace "¿Olvidaste tu contraseña?" | Error |
| `AUTH_EMAIL_TAKEN`   | 11       | Ese correo ya tiene una cuenta.                           | Enlace "Inicia sesión"             | Error |
| `AUTH_WEAK_PASSWORD` | 11       | Usa al menos 8 caracteres.                                | —                                  | Error |
| `AUTH_LINK_EXPIRED`  | 13       | El enlace venció. Pide uno nuevo.                         | Reenviar                           | Error |
| `UP_FORMAT`          | 18       | Por ahora aceptamos PDF, Word, PowerPoint y texto.        | Elegir otro archivo                | Error |
| `UP_SIZE`            | 18       | Supera el límite de 50 MB.                                | Quitar de la lista                 | Error |
| `UP_QUOTA`           | 18       | Tu espacio está al 96 %. Libera espacio o cambia de plan. | Ver planes                         | Aviso |
| `UP_NETWORK`         | 18       | Sin conexión durante la subida. No se perdió nada.        | Reintentar                         | Error |

> **Incompleto:** la tabla original continúa más allá de `UP_NETWORK`; las filas restantes aún no
> se han transcrito.
