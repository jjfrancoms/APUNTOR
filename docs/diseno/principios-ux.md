# Principios de UI/UX para Apuntor

Reglas accionables destiladas de seis libros de referencia, aplicadas a esta app. No es un
resumen de los libros: son las ideas centrales (públicas y ampliamente citadas) convertidas en
criterios que se revisan pantalla por pantalla. `DESIGN.md` sigue mandando sobre tokens y
estilo; este documento dice **cómo decidir**.

Fuentes: _Refactoring UI_ (Wathan y Schoger), _Practical UI_ (Dannaway), _Don't Make Me
Think_ (Krug), _The Design of Everyday Things_ (Norman), _Microinteractions_ (Saffer) y
_Laws of UX_ (Yablonski, lawsofux.com).

## 1. Jerarquía y sistema visual (Refactoring UI, Practical UI)

- **Jerarquía sin abusar del tamaño.** Para restar importancia se usa primero el color
  (`textMuted`) y el peso; el tamaño solo cuando hace falta. Un dato secundario en gris pesa
  menos que uno pequeño en negro.
- **Énfasis por contraste, no por adorno.** Para destacar algo, apaga lo que lo rodea antes de
  subirle el volumen a eso.
- **Las etiquetas son el último recurso.** "Correo: ana@…" se muestra como el dato; si el
  formato lo explica, la etiqueta sobra.
- **Separar de la etiqueta del dato:** el valor (precio, puntaje, cuota) es lo grande; su
  nombre es pequeño y gris.
- **Escala fija.** Tamaños de letra, espacios y radios solo desde los tokens; nada de valores
  sueltos. Pocos pesos tipográficos (regular y bold, a lo sumo semibold).
- **Empieza con demasiado espacio y quita.** Entre grupos, más espacio que dentro de un grupo.
- **Menos bordes.** Para separar, primero espacio, luego un cambio de fondo y por último una
  línea. Las sombras indican elevación (hojas, menús), no decoración.
- **Una acción principal por vista** (botón lleno); secundarias con borde o fantasma;
  terciarias como enlace. Lo destructivo no es el botón más llamativo salvo en su confirmación.
- **Botones con verbo concreto:** "Subir apuntes", no "Aceptar".
- **Texto de lectura:** 45–75 caracteres por línea, interlineado 1.5–1.7, alineado a la
  izquierda.
- **Modo oscuro:** menos contraste que blanco puro sobre negro puro; superficies más claras
  = más elevadas; colores de acento algo más claros y menos saturados.
- **Contraste mínimo AA** (4.5:1 texto, 3:1 controles y bordes que indican estado).

## 2. Usabilidad (Don't Make Me Think)

- **Se escanea, no se lee.** Títulos claros, párrafos cortos, listas. La primera palabra de
  cada línea tiene que decir de qué trata.
- **Obvio > ingenioso.** Nombres de secciones y botones que no requieran pensar ("Mis
  cursos", no "Tu espacio").
- **Cada pantalla responde:** ¿dónde estoy?, ¿qué puedo hacer aquí?, ¿cómo vuelvo? (título
  visible, acción principal visible, atrás siempre en el mismo lugar).
- **Quitar la mitad de las palabras**, y luego la mitad de lo que queda: fuera instrucciones
  que nadie lee y textos de bienvenida de relleno.
- **Convenciones antes que originalidad** en navegación, formularios y controles.
- **Prueba rápida:** si alguien nuevo duda más de un par de segundos sobre qué tocar, la
  pantalla falla.

## 3. Pistas y retroalimentación (The Design of Everyday Things)

- **Affordances y signifiers:** lo tocable parece tocable (botones con forma, chips de cita
  con flecha, el ojo en la contraseña); lo que no se toca no lo parece.
- **Mapeo natural:** el control está junto a lo que cambia (el filtro sobre la lista que
  filtra; "Reintentar" junto al error).
- **Feedback inmediato y claro** a cada acción: presionado, cargando, listo, error.
- **Restricciones** que evitan errores (botón desactivado hasta que el formulario es
  válido, con el motivo visible).
- **Errores sin culpa y con salida:** qué pasó, por qué y qué hacer (ya es regla del
  producto con los códigos estables).
- **Modelo mental:** curso → clase/documento → tema → resumen/chat, igual en navegación,
  títulos y migas.

## 4. Microinteracciones (Microinteractions)

Cada microinteracción tiene **disparador → reglas → feedback → bucles/modos**.

- **Disparador visible** y con estado (hover, presionado, foco, desactivado).
- **Feedback proporcional:** pequeño para acciones pequeñas (check, cambio de color),
  explícito para lo importante (aviso, pantalla de éxito).
- **No empezar de cero:** recordar lo último (borrador del chat, curso elegido, filtro).
- **Validación de formularios** al salir del campo, no mientras se escribe; el error junto al
  campo, nunca solo arriba.
- **Movimiento con propósito:** 120–240 ms, aceleración y frenado (tokens `motion`), y nada con
  movimiento reducido.
- **Estados de carga** con lo que está pasando ("Leyendo tus apuntes…"), no un spinner mudo.

## 5. Leyes de UX (Laws of UX)

| Ley                           | Qué dice                                             | En Apuntor                                                                   |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Fitts**                     | Lo grande y cercano se toca más rápido               | Acción principal grande y abajo en el celular; objetivos ≥ 44 px             |
| **Hick**                      | Más opciones = decisión más lenta                    | Pocas acciones por pantalla; lo avanzado en un menú o en Perfil              |
| **Jakob**                     | La gente espera que funcione como otras apps         | Barra inferior, atrás arriba a la izquierda, chat como apps de mensajes      |
| **Miller / Chunking**         | La memoria de trabajo es limitada                    | Agrupar en bloques; listas cortas; temas plegados                            |
| **Proximidad / Región común** | Lo cercano o dentro del mismo fondo se ve como grupo | Espacio y fondos para agrupar, no cajas por todos lados                      |
| **Similitud**                 | Lo que se ve igual se entiende igual                 | Un mismo estilo por tipo de acción en toda la app                            |
| **Von Restorff**              | Lo distinto se recuerda                              | Solo una cosa destacada por vista (el plan Recomendado, la acción principal) |
| **Serial position**           | Se recuerda lo primero y lo último                   | Lo clave al inicio y al final de listas y páginas                            |
| **Doherty**                   | Respuesta < 400 ms mantiene el flujo                 | Feedback instantáneo; mostrar el progreso del chat y la subida               |
| **Goal-gradient**             | Se acelera cerca de la meta                          | Progreso visible en subida, quiz y repaso                                    |
| **Zeigarnik**                 | Lo incompleto se recuerda                            | "Sigue donde lo dejaste" en Inicio                                           |
| **Peak-end**                  | Se juzga por el mejor momento y el final             | Cuidar el resultado del quiz y la respuesta con cita                         |
| **Tesler**                    | La complejidad no desaparece, se traslada            | Que la app la absorba (clasificar, ordenar temas), no el estudiante          |
| **Postel**                    | Ser flexible con lo que se recibe                    | Aceptar formatos y fechas variadas; corregir en vez de rechazar              |
| **Estética-usabilidad**       | Lo bonito se percibe más fácil                       | Pulir lo visible primero: acceso, Inicio, respuesta del chat                 |

## Lista de revisión por pantalla

1. ¿Se entiende en 3 segundos qué es y qué hacer aquí?
2. ¿Hay una sola acción principal y es la más visible?
3. Prueba de entrecerrar los ojos: ¿lo que más resalta es lo correcto?
4. ¿El espacio agrupa bien (más entre grupos que dentro)?
5. ¿Sobra texto, alguna etiqueta o alguna caja?
6. ¿Todo lo tocable parece tocable y responde al tocarlo?
7. ¿Los estados vacío, cargando, error y sin conexión están cuidados?
8. ¿Contraste AA y objetivos de 44 px?
