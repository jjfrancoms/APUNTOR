# Auditoría de UX por pantalla

Revisión de cada ruta de `app/src/app/**` con la lista de ocho preguntas y las diez heurísticas
de `principios-ux.md`. «Corregido» = arreglado en este pase; «Pendiente» = anotado para después.
Las pantallas de `previewOnly` (fases pendientes) se revisaron con sus datos de ejemplo.

Leyenda de heurísticas: H1 estado visible, H3 control y libertad, H5 prevención de errores,
H6 reconocer antes que recordar, H9 errores claros, H4 consistencia.

## Perfil

| Pantalla               | Problemas                                                                                                             | Estado                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Editar perfil (54)     | «Guardar» y «Cambiar contraseña» sin estado de carga: doble envío (H1). Correo sin validar al salir del campo.        | Corregido: botones con `loading`, aviso de correo al salir del campo |
| Ayuda (42)             | Sin hallazgos graves; la ayuda va en contexto.                                                                        | Sin cambios                                                          |
| Notificaciones (34)    | Solo un aviso de «muy pronto» (fase 4); no hay ajustes que guardar.                                                   | Sin cambios                                                          |
| Suscripción (32)       | Vista previa; un solo botón principal («Mejorar plan»).                                                               | Sin cambios                                                          |
| Contactar soporte (43) | Vista previa: el envío no tiene carga ni error real (H1).                                                             | Pendiente hasta tener endpoint                                       |
| Borrar cuenta (40)     | Cumple: confirmación escrita, contraseña, carga y «Cancelar». El botón rojo es el principal solo aquí (confirmación). | Sin cambios                                                          |

## Subida y documentos

| Pantalla                    | Problemas                                                                                                                                      | Estado                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Subir (17)                  | Una acción principal abajo; «Escanear» como ghost. Cumple.                                                                                     | Sin cambios                                                                                                    |
| Progreso de subida          | Pasos y barra visibles, se puede salir (aviso). Cumple (H1, goal-gradient).                                                                    | Sin cambios                                                                                                    |
| Revisar clasificación (16)  | «Aceptar» no dice qué hace (verbo vago). «Crear curso» repetido en el alternador y en el envío. Dos botones llenos a la vez al crear o elegir. | Corregido: «Mover al curso sugerido», «Crear y mover»; el principal pasa a secundario mientras se elige o crea |
| Escanear / revisar escaneo  | Principal «Subir N páginas» abajo, «Agregar más» fantasma; cumple.                                                                             | Sin cambios                                                                                                    |
| Problemas de subida         | «Reintentar fallidos» se desactiva sin fallos; explicado por el aviso. Cumple.                                                                 | Sin cambios                                                                                                    |
| Errores de proceso / idioma | Vista previa: acciones claras con salida («Reintentar», «Descartar»).                                                                          | Sin cambios                                                                                                    |
| Detalle de documento (21)   | Tres botones al pie (preguntar lleno, dos secundarios): bien. Guardar nombre era «Guardar» a secas.                                            | Corregido: «Guardar nombre». Borrar pide confirmación                                                          |

## Cursos, tema, búsqueda y conversación

| Pantalla                                                | Problemas                                                                                                          | Estado      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------- |
| Cursos / curso / búsqueda                               | Jerarquía ya revisada. Búsqueda con estado de carga y reintento junto al error.                                    | Sin cambios |
| Clase y tema por ruta                                   | Vista previa; el tema real vive en `topic`.                                                                        | Sin cambios |
| Chat (conversación)                                     | Cumple la tabla de microinteracciones: burbuja al instante, «Detener», reintentar sin duplicar, borrador guardado. | Sin cambios |
| Respondiendo / error / sin conexión / fuera de material | Vista previa de los estados del chat; cada error trae acción.                                                      | Sin cambios |

## Estudio

| Pantalla             | Problemas                                                                                               | Estado                               |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Configurar quiz (60) | Generar queda desactivado sin conexión o sin cupo, con el motivo en pantalla. Carga con texto genérico. | Corregido: «Preparando tu práctica…» |
| Tarjetas (61)        | «Aún no» en rojo (`dangerOutline`): el rojo es para lo destructivo, no para «todavía no lo sé» (H4).    | Corregido: secundario neutro         |
| Repaso (62)          | «Empezar repaso» principal y «Más tarde» fantasma. Cumple.                                              | Sin cambios                          |

## Acceso

| Pantalla                  | Problemas                                                                                   | Estado                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Inicio de sesión          | Botón con carga y desactivado: cumple. El error sale junto a la contraseña.                 | Pendiente: llevar el foco al campo culpable                          |
| Registro (11)             | Errores solo al enviar; el correo inválido mostraba «Correo o contraseña incorrectos» (H9). | Corregido: validación al salir del campo y mensaje propio del correo |
| Olvidé / restablecer      | Botón con carga y desactivado hasta tener un correo válido. Cumple.                         | Sin cambios                                                          |
| Enlace enviado            | Reenvío con cuenta atrás (evita el doble envío). Cumple.                                    | Sin cambios                                                          |
| Confirmar edad (58)       | Botón «Continuar» vago.                                                                     | Corregido: «Confirmar mi edad»                                       |
| Privacidad (15)           | Una acción principal, casilla de aceptación y enlace a la política. Cumple.                 | Sin cambios                                                          |
| Onboarding (14)           | Un solo paso con «Continuar» genérico; «Omitir» como enlace.                                | Corregido: «Empezar a estudiar»                                      |
| Permiso de notificaciones | Vista previa; «Activar» y «Ahora no». Cumple.                                               | Sin cambios                                                          |

## Inicio, planes y resto

| Pantalla             | Problemas                                                                                                    | Estado                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Inicio (6)           | Faltaba un retorno a lo que quedó a medias (Zeigarnik): solo había «Tu último documento».                    | Corregido: «Sigue donde lo dejaste» con la última conversación y el último documento |
| Planes (31)          | Un plan recomendado, un botón principal. Cumple (Von Restorff, Hick).                                        | Sin cambios                                                                          |
| Lista de espera (44) | Botón con carga y desactivado hasta tener correo y consentimiento. Cumple.                                   | Sin cambios                                                                          |
| Resumen compartido   | Solo lectura; un botón («Crear mi cuenta») y «Reportar». Cumple.                                             | Sin cambios                                                                          |
| Admin                | «Eliminar» como botón rojo en cada fila: más llamativo de lo que pide la regla; la confirmación es correcta. | Corregido: secundario en la fila, rojo solo en la confirmación                       |

## Componentes compartidos

| Componente | Cambio                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `Field`    | Jerarquía etiqueta (seminegrita) > error (13 px, rojo, con ícono) > ayuda (12 px, apagada).         |
| `Card`     | Encabezado con ritmo propio y pie en fila (acciones o metadatos) separados por línea fina.          |
| `ListRow`  | Título (seminegrita) frente a descripción (13 px, apagada), más legible que 12 px.                  |
| `TabBar`   | Barra lateral: la pestaña activa en seminegrita y marca; las inactivas en regular y apagadas.       |
| `Sheet`    | En oscuro, la hoja usa `surfaceAlt` (más clara que la página): la elevación se ve sin sombra.       |
| `Button`   | Comprobado: `loading` deja el botón inactivo (`disabled`) y marca `busy` para lectores de pantalla. |
| `Toggle`   | Los ajustes se guardan en el dispositivo (síncrono, sin fallo posible); no hay nada que revertir.   |

## Pendiente

- Llevar el foco al campo culpable tras un error de inicio de sesión.
- Bordes de campos con contraste 3:1 (hoy `border` está pensado como separador; afecta a claro y oscuro).
- Cuando existan ajustes que se guarden en el servidor (notificaciones, fase 4), dar a `Toggle` un
  modo «guardando» que vuelva al estado anterior y avise si falla.
