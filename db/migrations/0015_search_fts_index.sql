-- Índice de texto completo para `GET /v1/search` (api/src/search.ts). PENDIENTE: aún no es una
-- migración numerada; hay que pasarla a `db/migrations/` (o aplicarla a mano) para activarlo.
-- Sin él la búsqueda funciona igual, solo más lenta: filtra los fragmentos del propio usuario.
--
-- No usa `unaccent` (no es inmutable y no existe en PGlite): pliega acentos con `translate`. La
-- expresión debe ser idéntica a `vectorOf()` de api/src/search.ts, con las mismas `FOLD_FROM` y
-- `FOLD_TO`, para que el planificador la use (lo comprueba tests/db/search.test.ts). Las marcas
-- combinantes del final de la primera cadena no tienen pareja: `translate` las borra.
CREATE INDEX IF NOT EXISTS document_chunks_content_fts_idx
  ON document_chunks
  USING gin (to_tsvector('simple'::regconfig, lower(translate(content, 'ÁÀÄÂÃáàäâãÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÑñÇç̀́̂̃̈', 'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunncc'))));
