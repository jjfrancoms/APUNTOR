# DESIGN.md — Identidad visual de APUNTOR

Fuente de verdad del aspecto de la app. Cualquier skill de diseño (`frontend-design`,
`impeccable`, `ui-ux-pro-max`) debe **respetar este archivo antes que sus propias propuestas**:
no inventes paletas, tipografías ni estilos nuevos. Los valores salen de
`app/src/theme/tokens.ts` y un test (`app/tests/design-md.test.ts`) verifica que coincidan.

## Producto y tono

- App de estudio con los **apuntes propios** del estudiante (Perú, español; también inglés).
- Calma y confianza: fondos cálidos y claros, un solo color de marca, mucho aire.
- Mascota amable que acompaña, nunca protagonista de la interfaz. Illari es una llama: orejas en
  forma de plátano, copete de lana, hocico alargado con labio partido y cuello largo.
- Textos cortos, sin culpar al usuario y siempre con una acción (ver `docs/producto/mvp-ux.md`).

## Plataforma

- **Expo / React Native** (Android, iOS y web). No hay CSS ni Tailwind ni shadcn: los estilos
  son `StyleSheet` y los colores salen de `useTheme()`. Las reglas web de las skills aplican
  solo a la exportación web.
- Variantes: móvil (< 600 px, barra inferior), tablet (600–1023 px, barra lateral de 88 px) y
  escritorio (≥ 1024 px, barra lateral de 280 px, Inicio en dos columnas).

## Color

Significado fijo: **verde = material propio**, **violeta = contexto externo (siempre con
fuente)**, **ámbar = avisos y mascota (nunca texto)**, **rojo = errores y acciones destructivas**.

| Token          | Claro       | Oscuro      | Uso                                          |
| -------------- | ----------- | ----------- | -------------------------------------------- |
| `bg`           | `#FAF9F6`   | `#121413`   | Fondo de pantalla                            |
| `surface`      | `#FFFFFF`   | `#1C1F1E`   | Tarjetas, campos, barras                     |
| `surfaceAlt`   | `#F2F0EB`   | `#262A29`   | Segmentados, esqueletos, campos bloqueados   |
| `border`       | `#E7E4DD`   | `#363B3A`   | Bordes y separadores                         |
| `text`         | `#1C1C1E`   | `#F2F2F0`   | Texto principal                              |
| `textMuted`    | `#6B6B72`   | `#A9AEAC`   | Texto secundario                             |
| `primary`      | `#1D7568`   | `#4DB6A6`   | Marca, acciones principales, material propio |
| `onPrimary`    | `#FFFFFF`   | `#0B1F1C`   | Texto sobre `primary`                        |
| `primarySoft`  | `#E3F1EE`   | `#1B3A36`   | Fondos de selección y tarjetas destacadas    |
| `external`     | `#5B4FC7`   | `#B3A8F7`   | Contexto externo                             |
| `externalSoft` | `#ECEAFB`   | `#2A2650`   | Fondo del contexto externo                   |
| `danger`       | `#C0392B`   | `#F28B80`   | Errores, eliminar                            |
| `dangerSoft`   | `#FBEAE8`   | `#3D1F1C`   | Fondo de errores                             |
| `accent`       | `#F2A93B`   | `#F2A93B`   | Avisos, mascota. **Prohibido como texto**    |
| `accentSoft`   | `#FDF1DC`   | `#3A2E17`   | Fondo de avisos                              |
| `scrim`        | `#1C1C1E66` | `#000000A3` | Velo detrás de hojas y diálogos. Nunca texto |

- Todo par texto/fondo cumple WCAG AA (≥ 4,5:1); lo prueba `TEXT_PAIRS` en `tokens.ts`.
- Nunca hex sueltos en pantallas: siempre `useTheme().c.<token>`.
- Sin degradados, sin sombras marcadas, sin glassmorphism.
- La mascota usa su propia paleta de ilustración (`mascotPalette` en `tokens.ts`): es parte
  del dibujo, no cambia con el tema y no se usa en la interfaz.

## Logo

El kit vive en `docs/marca/` (`LEEME.txt`, `svg/`, `png/` y la hoja de marca). El isotipo es una
cabeza de llama de línea; el logotipo es "APUNTOR" en Montserrat Bold, ya convertido a trazados.

- **Variantes de color**: `color` (#1D7568, sobre fondo claro) y `oscuro` (#4DB6A6, sobre fondo
  oscuro) son exactamente `primary` en claro y en oscuro; `negro` (#1C1C1E) es para impresión a una
  tinta y `blanco` para el verde de marca o fotos. En la app, `BrandLogo` toma el color de `primary`
  y cambia solo con el tema; en la web el SVG en línea usa `fill: var(--primary)`.
- **Piezas**: isotipo, logotipo, vertical y horizontal, más el icono de app (1024 cuadrado para las
  tiendas; los lanzadores redondean solos) y los PNG 512, 180, 48, 32 y 16.
- **Logo o Illari**: el logo es la marca y va donde la app se presenta (barra lateral, acceso,
  registro, bienvenida, landing, páginas públicas e iconos). Illari es el personaje y sigue en estados
  vacíos, chat, cargas y el hero de la landing. Nunca se usan juntos como un solo sello ni se
  redibuja el logo con rasgos de Illari.
- **Tamaños mínimos**: isotipo 16 px de alto en pantalla (24 px en la app); logo horizontal 20 px de
  alto (unos 62 px de ancho); en la app los usos habituales son 28 a 36 px de alto.
- **Espacio libre**: al menos 1/4 del alto del logo por todos lados (el kit trae 40 px de margen
  en sus SVG). `BrandLogo` recorta ese margen, así que el aire lo da el contenedor.
- **Icono Android**: primer plano en blanco dentro del 66 % central, fondo verde de marca
  (`#1D7568`) y versión monocroma con la silueta.
- No cambiar proporciones, colores ni la tipografía; no usar el logo como adorno repetido.

## Tipografía

- Una sola familia: **Plus Jakarta Sans** (400, 500, 600, 700, 800).
- Escala (`app/src/theme/index.tsx`): display 28/34 · title 24/30 · heading 18/24 ·
  subheading 16/22 · body 15/22 · small 13/18 · caption 12/16 · overline 11/14 (+0,6).
- Overline en mayúsculas solo para encabezados de sección de listas, no sobre cada título ni como
  etiqueta de un campo.
- Ningún texto incrustado en imágenes; todo texto vive en `app/src/i18n/`.

## Espacio, forma y tamaño

- Espaciado: 4 · 8 · 12 · 16 · 20 · 24 · 32. Márgenes de pantalla: 20 (móvil), 32 (escritorio).
- Radios: 8 · 12 (campos y botones) · 16 (tarjetas) · 20 (hojas y diálogos) · píldora.
- Área táctil mínima 44 px; botón principal 52 px de alto.
- Ancho de lectura máximo: 720 px (móvil/tablet), 800 px (escritorio), 1120 px en pantallas
  de varias columnas, 480 px en acceso y registro (`Screen narrow`).

## Componentes y patrones

- Base en `app/src/components/ui/`: Button, TextField, DateField, SelectField, Card, Chip,
  Banner, ListRow, Sheet, Segmented, Toggle, Checkbox, Mascot, TopBar, Screen.
- Selectores (curso, tema, hora, clase, fecha) se despliegan **en línea** bajo el campo.
- Menús de acciones: hoja inferior en móvil; diálogo centrado desde tablet.
- El foco de los campos se marca con el borde `primary` (sin el anillo del navegador).
- Cada pantalla define estados cargando / vacío / error / sin conexión (`?demo=<estado>`).
- Íconos Feather; los que no llevan texto tienen `accessibilityLabel`.

## Movimiento

- Discreto y funcional: aparición de hojas (slide en móvil, fade en diálogos) y cambios de
  estado. Sin animaciones decorativas en bucle. Respeta “reducir movimiento” del sistema.

## Qué evitar

- Resaltar una palabra del título con otro color o cursiva.
- Etiquetas en mayúsculas sobre cada título, emojis como íconos, degradados genéricos.
- Usar el ámbar como color de texto o el violeta para material propio.
- Estilos de otras marcas (Linear, Stripe, etc.) o temas prediseñados que cambien esta paleta.
