# Orquestación de agentes

Cómo se reparte el trabajo entre agentes de Claude Code para no gastar de más. Los perfiles están en
`.claude/agents/`. El límite de concurrencia está en `.claude/settings.json`.

## Niveles

| Nivel    | Perfil                | Modelo | Esfuerzo    | Tope de turnos | Para qué                                                     |
| -------- | --------------------- | ------ | ----------- | -------------- | ------------------------------------------------------------ |
| Básico   | `apuntor-explorador`  | Haiku  | por defecto | 20             | Buscar y leer código. No edita.                              |
| Básico   | `apuntor-verificador` | Haiku  | por defecto | 12             | Correr pruebas e informar fallos. No edita.                  |
| Básico   | `apuntor-mecanico`    | Haiku  | por defecto | 30             | Cambios exactos en pocos archivos: textos, configuración.    |
| Medio    | `apuntor-constructor` | Sonnet | medium      | 60             | Una función acotada que sigue un patrón ya existente.        |
| Alto     | `apuntor-senior`      | Sonnet | high        | 80             | Funciones que cruzan API, worker y app. Integrar ramas.      |
| Avanzado | `apuntor-arquitecto`  | Opus   | high        | 80             | Base de datos y RLS, privacidad, sincronización, validar IA. |

## Cómo elegir el nivel

Se usa el nivel más bajo que pueda hacer bien la tarea.

1. ¿Solo hay que leer o correr comandos? Básico.
2. ¿La instrucción dice exactamente qué cambiar? Básico (`mecanico`).
3. ¿Hay un patrón igual en el proyecto y afecta una sola capa? Medio.
4. ¿Cruza varias capas o combina el trabajo de varias ramas? Alto.
5. ¿Un error expone datos, los corrompe o deja pasar una respuesta falsa de la IA? Avanzado.

Una tarea grande se parte: lo difícil va al nivel avanzado y las pantallas o lo repetitivo al medio.

## Reglas de ejecución

- Como máximo **2 agentes a la vez** (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`).
- Toda llamada a un agente indica su perfil. Sin perfil o modelo, hereda el modelo de la sesión principal.
- Para continuar trabajo interrumpido se lanza un agente **nuevo** sobre la misma copia de trabajo, con una
  lista de lo que falta. Reanudar uno anterior conserva su modelo y reenvía todo su historial.
- Cada agente hace commit por punto terminado, con rutas explícitas.
- Si se alcanza el límite de uso, se detiene la tanda y se avisa. No se relanza sin que lo pida el dueño.
- Las verificaciones largas las corre `apuntor-verificador`, no un agente caro.

## Trabajo pendiente (noviembre de 2026)

Las copias de trabajo están en `.claude/worktrees/`. El avance se revisa con `git log` y `git status` en cada una.

| Tanda | Trabajo                                           | Copia de trabajo          | Reparto                                                               |
| ----- | ------------------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| 1     | Documentos: reprocesar, cuota y validar resúmenes | `agent-ae58f5031eb0cf94f` | `senior`                                                              |
| 1     | Cuenta: exportar datos, lista de espera, borrado  | `agent-a7a26af68f64ead17` | `arquitecto` para exportar y borrar; `constructor` para la app        |
| 2     | Búsqueda y chat por documento                     | `agent-afc6ecb38e9b50806` | `constructor`                                                         |
| 2     | Modo sin conexión y configuración de builds       | `agent-a23b50495f619d8b1` | `constructor`; `mecanico` para `eas.json` y `app.json`                |
| 3     | Conversaciones en el servidor                     | `agent-a2de2b3d116f64774` | `arquitecto` para tablas y sincronización; `constructor` para la app  |
| 4     | Clasificación de cursos con IA                    | `agent-a0ef25628e1ad282a` | `senior`                                                              |
| 5     | Quizzes, tarjetas y repaso                        | `agent-a9b6fa9486134c67d` | `arquitecto` para generar y validar; `constructor` para las pantallas |
| 6     | Prueba de punta a punta                           | `agent-a737014611a026cc0` | `constructor`, con el trabajo anterior ya integrado                   |
| 7     | Integrar ramas y generar migraciones              | rama principal de trabajo | `senior`; `verificador` para las pruebas                              |
