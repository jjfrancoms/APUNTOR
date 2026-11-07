# Skills de diseño del proyecto

Copiadas tal cual de sus repositorios para que todo el equipo (y Claude Code en la nube) las
tenga sin instalar nada. Se cargan solas cuando la tarea es de interfaz. La identidad visual
manda: lee `DESIGN.md` en la raíz antes de seguir cualquier propuesta de estas skills.

| Skill             | Origen                                                                                       | Versión copiada        | Licencia   |
| ----------------- | -------------------------------------------------------------------------------------------- | ---------------------- | ---------- |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)   | commit `ca45fc4`       | Apache-2.0 |
| `impeccable`      | [pbakaus/impeccable](https://github.com/pbakaus/impeccable)                                  | 4.8.0, commit `9fadc41` | Apache-2.0 |
| `ui-ux-pro-max`   | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | commit `713eef5`       | MIT        |

## Notas

- **Impeccable sin hooks.** Su plugin oficial agrega hooks que, tras cada edición, ejecutan un
  binario que el lanzador descarga de GitHub. Aquí solo está la skill (comandos y guías). El
  detector (`scripts/impeccable detect`) descarga ese binario la primera vez que lo ejecutas a
  mano; verifica su suma con `scripts/engine-checksums.txt`. Trabaja sobre DOM/CSS, así que
  solo sirve para la exportación web (`app/dist`).
- **UI/UX Pro Max** trae un buscador local en Python (`scripts/search.py`, sin red) sobre sus
  datos. Para esta app: `--stack react-native`.
- Para actualizar una skill, vuelve a copiar su carpeta desde el repositorio y cambia la
  versión en esta tabla.

## No incluidas (a propósito)

- `marvkr/better-design`: temas que copian la identidad de otras marcas (Linear, Stripe…) y
  un servidor MCP externo; chocaría con la paleta propia de `DESIGN.md`. Su guía solo está
  disponible con ese servidor conectado.
- `bergside/awesome-design-skills` (67 estilos) y `SlideSpeak/presentation-design-prompts`:
  estilos alternativos y plantillas de presentaciones, no aplican a la app.
- `document-skills` (pptx, docx, xlsx, pdf de Anthropic): no son parte del producto; quien
  las quiera puede instalarlas en su Claude Code con
  `/plugin marketplace add anthropics/skills` y luego `/plugin install document-skills@anthropic-agent-skills`.
