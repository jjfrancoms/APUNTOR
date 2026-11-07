# Cumplimiento legal: lista de verificación fuera del código

Lo que el titular de APUNTOR debe hacer o confirmar antes del lanzamiento público. Acompaña a
[terminos.md](./terminos.md) y [privacidad.md](./privacidad.md) (versión `2026-11-07`).

**Fuentes.** "Ley 29733" = Ley N.° 29733, Ley de Protección de Datos Personales, según el texto
publicado en El Peruano el 3 de julio de 2011 (texto original; leído completo). Sus artículos se
citan solo de ese texto: pueden haber sido modificados después (verificar). El reglamento vigente
(Decreto Supremo N.° 016-2024-JUS) **no se pudo consultar**: todo lo que depende de él lleva la
marca **por verificar con el reglamento DS 016-2024-JUS y un abogado**. La Ley N.° 29571 (Código
de Protección y Defensa del Consumidor) tampoco se leyó para esta lista.

## 1. Datos por completar en los textos

- [x] Datos del responsable completados el 07/11/2026 (persona natural, RUC 10762140859).
      Domicilio tomado de la Ficha RUC (domicilio fiscal). Antes:
      `[RAZÓN SOCIAL]` / `[LEGAL NAME]`, `[RUC]`, `[DOMICILIO]` / `[ADDRESS]` y
      `[CORREO DE PRIVACIDAD]` / `[PRIVACY EMAIL]` en `app/src/i18n/legal.ts` y en los `.md`.
      Fuente: Ley 29733, art. 18 (informar la identidad y domicilio del titular del banco de
      datos) y art. 29 (publicidad de identidad y domicilio del titular).
- [ ] `[PLAZO DE RESPUESTA]` / `[RESPONSE PERIOD]` (sección 9 de la privacidad): plazos para
      atender cada derecho ARCO. **Por verificar con el reglamento DS 016-2024-JUS y un abogado.**
- [ ] El correo de privacidad debe existir, tener responsable y revisarse a diario.
- [ ] Al completar los corchetes desaparece el aviso de borrador; antes, revisión por abogado
      (punto 9). Si el texto cambia, subir `LEGAL_VERSION` y `LEGAL_UPDATED`.

## 2. Inscripción del banco de datos ante la ANPD

- [ ] Determinar si corresponde inscribir el banco de datos "Usuarios de APUNTOR" en el
      Registro Nacional de Protección de Datos Personales y hacerlo antes de tratar datos de
      usuarios reales. Fuente: Ley 29733, art. 29 (creación de bancos de datos según el
      reglamento), art. 34.1 (el Registro inscribe los bancos de administración privada) y
      art. 38.2.e (no inscribir el banco es infracción grave). Requisitos, formulario, tasa y
      excepciones: **por verificar con el reglamento DS 016-2024-JUS y un abogado.**
- [ ] Comunicar en la inscripción los flujos transfronterizos (EE. UU.) si el reglamento lo
      exige. **Por verificar con el reglamento DS 016-2024-JUS y un abogado.**

## 3. Contratos de encargo (DPA) con cada proveedor

Fuente: Ley 29733, art. 2.6 (encargado), art. 30 (el encargado no puede usar los datos para otra
finalidad ni transferirlos; se suprimen al terminar el servicio), art. 15 (flujo transfronterizo
con nivel de protección adecuado) y art. 9 y 16 (seguridad). Contenido mínimo del contrato:
**por verificar con el reglamento DS 016-2024-JUS y un abogado.**

- [ ] **Supabase** (cuentas y base de datos, EE. UU., us-west-2): aceptar su DPA y guardar copia.
- [ ] **Cloudflare** (R2, archivos): DPA y ubicación de los datos.
- [ ] **Google** (API de Gemini / Vertex AI): DPA de Google Cloud. **Bloqueante:** la política
      promete que el contenido no se usa para entrenar modelos; el plan gratis de Google AI
      Studio (`GEMINI_API_KEY`) puede usar el contenido para mejorar productos de Google
      (ver `CLAUDE.md`), así que no puede usarse con usuarios reales. Confirmar por escrito las
      condiciones de retención y entrenamiento del servicio de pago (README, "Pendientes").
- [ ] **Tavily** (búsqueda externa): términos y DPA; confirmar qué guarda de las consultas.
- [ ] **Railway** (servidor de la API y worker): DPA y región de los servidores. Railway figura
      en la política aunque no estaba en la lista inicial de proveedores; quitarlo solo si deja
      de tratar datos.
- [ ] Proveedor de analítica (cuando se elija) y de correo transaccional (Supabase Auth u otro):
      añadirlos a la política y firmar su DPA.
- [ ] Confirmar cuánto tiempo guardan los proveedores copias de seguridad y registros tras el
      borrado de cuenta, y ajustar la sección 7 de la privacidad si no es "inmediato".
      **Por verificar.**

## 4. Consentimiento y flujo transfronterizo

- [ ] Casilla de aceptación sin marcar en el registro, con enlace a términos y privacidad, y
      registro de documento, versión y fecha. Fuente: Ley 29733, art. 5 y 13.5 (consentimiento
      previo, informado, expreso e inequívoco), art. 13.7 (revocación).
- [ ] Confirmar si el consentimiento debe ser separado para la transferencia internacional y
      para "Buscar fuera" (Tavily). Fuente: Ley 29733, art. 15 (numerales 4 y 7). Forma exigida:
      **por verificar con el reglamento DS 016-2024-JUS y un abogado.**
- [ ] Revisar que la versión aceptada se vuelva a pedir cuando cambie `LEGAL_VERSION`.

## 5. Derechos ARCO

- [ ] Procedimiento interno para atender pedidos al correo de privacidad (verificar identidad,
      registrar fecha, responder). Fuente: Ley 29733, arts. 18 a 23; art. 38.1.b y 38.2.c (no
      atender derechos es infracción). Plazos, formalidades y gratuidad: **por verificar con el
      reglamento DS 016-2024-JUS y un abogado.**
- [ ] Confirmar que "Descargar mis datos" incluye todo lo que el servidor guarda del usuario
      (art. 19, acceso) y que "Borrar cuenta" borra también archivos en R2 y vectores (art. 20).

## 6. Seguridad y notificación de incidentes

- [ ] Documentar las medidas de seguridad (cifrado, RLS, credenciales, accesos del equipo).
      Fuente: Ley 29733, art. 9 y 16 (medidas técnicas, organizativas y legales; requisitos que
      fija la Autoridad) y art. 17 (confidencialidad, también para el equipo).
- [ ] Plan de respuesta a incidentes: a quién y en qué plazo notificar (Autoridad y titulares).
      **Por verificar con el reglamento DS 016-2024-JUS y un abogado.** La Ley 29733 leída no
      fija un plazo de notificación.
- [ ] Confirmar que los registros del servidor no guardan el texto de las preguntas ni de los
      documentos (la política dice que el historial vive solo en el dispositivo). **Por verificar.**

## 7. Oficial de datos personales

- [ ] Determinar si APUNTOR debe designar un oficial de datos personales y comunicarlo.
      **Por verificar con el reglamento DS 016-2024-JUS y un abogado.** (La Ley 29733 leída no lo
      menciona.)

## 8. Libro de reclamaciones virtual

- [ ] Determinar si aplica el Libro de Reclamaciones virtual del Código de Protección y Defensa
      del Consumidor (Ley N.° 29571) mientras el servicio sea gratuito, y obligatoriamente
      cuando haya pagos. Si aplica, añadir el enlace en la app y en los términos (sección 14).
      **Por verificar con un abogado** (la Ley 29571 y su reglamento no se leyeron).

## 9. Revisión por abogado y otros puntos

- [ ] Revisión completa de términos, privacidad y suscripción por un abogado peruano en
      protección de datos y consumo, incluida la traducción al inglés y la cláusula de que
      prevalece la versión en español.
- [ ] Edad mínima 18: validar que la sola declaración es suficiente y qué hacer con cuentas de
      menores detectadas. Fuente: Ley 29733, art. 13.3 (los menores actúan mediante sus
      representantes legales; el reglamento dicta medidas especiales). Detalle: **por verificar
      con el reglamento DS 016-2024-JUS y un abogado.** Nota: `README.md` y `PRODUCT.md` aún
      hablan de consentimiento parental y lista de espera para menores; alinear.
- [ ] Derechos de autor del material subido: validar la cláusula 8 de los términos y el
      procedimiento para atender avisos de infracción. **Por verificar con un abogado.**
- [ ] Analítica "anónima": confirmar que lo es de verdad (sin identificador persistente ni IP);
      si no, declararla como dato personal. Fuente: Ley 29733, art. 2.4 (dato personal).
- [ ] Antes de cobrar: términos de suscripción completos (precio, renovación, cancelación,
      reembolsos) y revisión de consumo. **Por verificar con un abogado.**
- [ ] Sanciones de referencia: Ley 29733, art. 38 (infracciones leves, graves y muy graves) y
      art. 39 (multas). Verificar montos vigentes; pueden haber cambiado después de 2011.
