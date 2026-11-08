/**
 * Pruebas de extremo a extremo de APUNTOR (Expo web). Todo el servidor es falso: ver `support.ts`.
 * Los textos salen de `app/src/i18n/es.ts` para que un cambio de redacción no rompa las pruebas.
 */
import { es } from '../app/src/i18n/es';
import {
  ANSWER,
  ANSWER_CLAIM,
  CONSENTS_OUTDATED,
  DOCUMENT,
  EXPORT_DATA,
  PASSWORD_OK,
  SEARCH_WORD,
  SUMMARY_TEXT,
  TOPICS,
  USER,
} from './fixtures';
import { expect, test } from './support';
import type { Page } from '@playwright/test';

const t = es.topicView;
const TEMA_SIN_SECCIONES = TOPICS[2]?.title ?? '';
const TEMA_CON_SECCIONES = TOPICS[0]?.title ?? '';
const SECCION = TOPICS[1]?.title ?? '';
const PREGUNTA = '¿Qué es una tautología?';

/** El único campo de texto del chat (su nombre cambia mientras Illari responde). */
const chatInput = (page: Page) => page.getByRole('textbox');

/** Escribe en el chat y envía con Enter. */
async function ask(page: Page, text: string): Promise<void> {
  await chatInput(page).fill(text);
  await chatInput(page).press('Enter');
}

/** Cuerpo de una petición a /v1/questions. */
const questionBody = (body: unknown): { question?: string; documentIds?: string[] } =>
  body as { question?: string; documentIds?: string[] };

test.describe('Entrada a la app', () => {
  test('con sesión entra a Inicio y sin sesión al inicio de sesión', async ({ page, mock }) => {
    // Sin sesión.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/u);
    await expect(page.getByRole('heading', { name: es.login.title })).toBeVisible();

    // Con sesión (se inyecta antes de cargar la app).
    await mock.signIn('email');
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/u);
    await expect(page.getByText(es.home.hello(USER.firstName))).toBeVisible();
  });

  test('si no se aceptó la versión vigente de los términos, la app los pide', async ({
    page,
    mock,
  }) => {
    mock.consents = CONSENTS_OUTDATED;
    await mock.signIn('email');
    await page.goto('/');
    await expect(page).toHaveURL(/\/privacy$/u);
    await expect(page.getByText(es.privacy.header)).toBeVisible();
    await expect(page.getByRole('button', { name: es.privacy.submit })).toBeVisible();
  });
});

test.describe('Cursos y resúmenes', () => {
  test(
    'el índice de temas está plegado: tocar un tema muestra sus secciones y volver a tocarlo las oculta',
    { tag: '@telefono' },
    async ({ page, mock }) => {
      await mock.signIn('email');
      await page.goto(`/documents/${DOCUMENT.id}`);

      const tema = page.getByRole('button', { name: TEMA_CON_SECCIONES, exact: true });
      await expect(tema).toBeVisible();
      await expect(tema).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText(SECCION, { exact: true })).toBeHidden();

      await tema.click();
      await expect(tema).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText(SECCION, { exact: true })).toBeVisible();

      await tema.click();
      await expect(tema).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText(SECCION, { exact: true })).toBeHidden();
    },
  );

  test('el resumen del tema muestra título, tabla, fórmula y un bloque sin verificar sin enlace a página; el límite diario avisa', async ({
    page,
    mock,
  }) => {
    await mock.signIn('email');
    const url = `/topic?doc=${DOCUMENT.id}&id=t3&title=${encodeURIComponent(TEMA_SIN_SECCIONES)}`;
    await page.goto(url);

    await expect(page.getByText(TEMA_SIN_SECCIONES, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: SUMMARY_TEXT.heading })).toBeVisible();
    // Tabla: encabezado compuesto y celdas de las dos filas.
    await expect(page.getByText('p ∧ q', { exact: true })).toBeVisible();
    await expect(page.getByText('V', { exact: true })).toHaveCount(4);
    await expect(page.getByText('F', { exact: true })).toHaveCount(2);
    await expect(page.getByText(SUMMARY_TEXT.formula, { exact: true })).toBeVisible();
    // Los bloques verificados enlazan su página; el no verificado avisa y no enlaza.
    await expect(page.getByRole('link', { name: t.checkPage(4) })).toHaveCount(2); // párrafo y tabla
    await expect(page.getByRole('link', { name: t.checkPage(5) })).toHaveCount(1); // fórmula
    await expect(page.getByText(SUMMARY_TEXT.unverified)).toBeVisible();
    await expect(page.getByText(t.unverified, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: t.checkPage(6) })).toHaveCount(0);

    // Cuota diaria de resúmenes nuevos agotada.
    mock.on('GET', `/v1/documents/${DOCUMENT.id}/topics/t3/summary`, () => ({
      status: 429,
      json: { error: { code: 'SUMMARY_DAILY_LIMIT' } },
    }));
    await page.goto(url);
    await expect(page.getByText(t.limitTitle)).toBeVisible();
    await expect(page.getByText(t.limitBody)).toBeVisible();
  });

  test('buscar una palabra de los apuntes muestra Documentos, Temas y En tus apuntes', async ({
    page,
    mock,
  }) => {
    await mock.signIn('email');
    await page.goto('/courses/search');
    await page.getByPlaceholder(es.search.placeholder).fill(SEARCH_WORD);

    await expect(page.getByText(es.search.documents, { exact: true })).toBeVisible();
    await expect(page.getByText(es.search.topics, { exact: true })).toBeVisible();
    await expect(page.getByText(es.search.inNotes, { exact: true })).toBeVisible();
    const busqueda = mock.calls('GET', '/v1/search').at(-1);
    expect(busqueda?.query.get('q')).toBe(SEARCH_WORD);
  });
});

test.describe('Chat', () => {
  test(
    'preguntar desde un tema limita el chat a ese documento y la × amplía el alcance',
    { tag: '@telefono' },
    async ({ page, mock }) => {
      await mock.signIn('email');
      await page.goto(`/documents/${DOCUMENT.id}`);
      await page
        .getByRole('button', { name: es.courses.openTopicLabel(TEMA_SIN_SECCIONES) })
        .click();
      await page.getByRole('button', { name: t.ask }).click();

      const alcance = page.getByText(es.chat.scopeOnly(DOCUMENT.title), { exact: true });
      await expect(alcance).toBeVisible();
      await expect.poll(() => mock.calls('POST', '/v1/questions').length).toBe(1);
      expect(questionBody(mock.calls('POST', '/v1/questions')[0]?.body).documentIds).toEqual([
        DOCUMENT.id,
      ]);

      await page.getByRole('button', { name: es.chat.scopeWiden }).click();
      await expect(alcance).toBeHidden();
      await ask(page, 'otra duda');
      await expect.poll(() => mock.calls('POST', '/v1/questions').length).toBe(2);
      expect(mock.calls('POST', '/v1/questions')[1]?.body).toEqual({ question: 'otra duda' });
    },
  );

  test('la respuesta muestra término, fórmula y chip de página, sin "[pág." en el texto', async ({
    page,
    mock,
  }) => {
    await mock.signIn('email');
    await page.goto('/conversation');
    await ask(page, PREGUNTA);

    await expect(page.getByText(ANSWER_CLAIM.label, { exact: true })).toBeVisible();
    await expect(page.getByText(ANSWER_CLAIM.formula, { exact: true })).toBeVisible();
    await expect(page.getByText(ANSWER_CLAIM.text)).toBeVisible();
    await expect(
      page.getByRole('link', { name: es.chat.checkPage(ANSWER_CLAIM.page) }),
    ).toBeVisible();
    await expect(page.getByText(es.chat.ownSource(ANSWER_CLAIM.page))).toBeVisible();
    await expect(page.getByText('[pág.')).toHaveCount(0);
    expect(JSON.stringify(ANSWER)).not.toContain('[pág.');
  });

  test('"Hola" recibe el saludo sin aviso de "no encontré" y un texto corto sin coincidencias pide reformular', async ({
    page,
    mock,
  }) => {
    mock.on('POST', '/v1/questions', ({ body }) =>
      questionBody(body).question === 'Hola'
        ? { json: { status: 'small_talk', kind: 'greeting' } }
        : { json: { status: 'abstained', message: 'sin resultados', reason: 'no_matches' } },
    );
    await mock.signIn('email');
    await page.goto('/conversation');

    await ask(page, 'Hola');
    await expect(page.getByText(es.chat.smallTalk.greeting)).toBeVisible();
    await expect(page.getByText(es.chat.notFound)).toHaveCount(0);

    await ask(page, 'xq');
    await expect(page.getByText(es.chat.notFoundUnclear('xq'))).toBeVisible();
    await expect(page.getByText(es.chat.searchOutside)).toHaveCount(0);
  });

  test('mientras Illari responde, Detener cancela y escribir conserva el borrador sin enviarlo', async ({
    page,
    mock,
  }) => {
    let soltar: () => void = () => undefined;
    const espera = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    mock.on('POST', '/v1/questions', async () => {
      await espera;
      return { json: ANSWER };
    });
    await mock.signIn('email');
    await page.goto('/conversation');
    await ask(page, PREGUNTA);
    const detener = page.getByRole('button', { name: es.chat.stop });
    await expect(detener).toBeVisible();

    // Escribir y pulsar Enter con la respuesta en camino: el borrador queda y no se envía nada.
    await chatInput(page).fill('otra pregunta');
    await chatInput(page).press('Enter');
    await expect(chatInput(page)).toHaveValue('otra pregunta');
    await expect(page.getByText(es.chat.pendingDraftHint)).toBeVisible();
    expect(mock.calls('POST', '/v1/questions')).toHaveLength(1);

    await detener.click();
    await expect(page.getByText(es.chat.cancelled)).toBeVisible();
    await expect(chatInput(page)).toHaveValue('otra pregunta');
    soltar();
  });

  test('tras un error, Reintentar no duplica la burbuja y Editar devuelve el texto al campo', async ({
    page,
    mock,
  }) => {
    let intento = 0;
    mock.on('POST', '/v1/questions', () => {
      intento += 1;
      // Fallan el primer intento y la segunda pregunta; el reintento del primero funciona.
      return intento === 1 || intento === 3
        ? { status: 500, json: { error: { code: 'INTERNAL' } } }
        : { json: ANSWER };
    });
    await mock.signIn('email');
    await page.goto('/conversation');

    await ask(page, PREGUNTA);
    await expect(page.getByText(es.chat.failedTitle)).toBeVisible();
    await page.getByText(es.chat.retry, { exact: true }).click();
    await expect(page.getByText(ANSWER_CLAIM.text)).toBeVisible();
    await expect(page.getByText(PREGUNTA, { exact: true })).toHaveCount(1);
    await expect(page.getByText(es.chat.failedTitle)).toHaveCount(0);

    await ask(page, 'segunda pregunta');
    await expect(page.getByText(es.chat.failedTitle)).toBeVisible();
    await page.getByText(es.chat.edit, { exact: true }).click();
    await expect(chatInput(page)).toHaveValue('segunda pregunta');
    await expect(page.getByText('segunda pregunta', { exact: true })).toHaveCount(0);
    await expect(page.getByText(es.chat.failedTitle)).toHaveCount(0);
    // La primera pareja pregunta-respuesta sigue intacta.
    await expect(page.getByText(PREGUNTA, { exact: true })).toHaveCount(1);
  });

  test('sin conexión aparece el aviso, no se envía, el borrador queda y al volver no se envía solo', async ({
    page,
    mock,
    context,
  }) => {
    await mock.signIn('email');
    await page.goto('/conversation');
    await expect(chatInput(page)).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(es.connection.chat)).toBeVisible();
    await chatInput(page).fill('pregunta sin red');
    await expect(page.getByRole('button', { name: es.chat.send })).toBeDisabled();
    await chatInput(page).press('Enter');
    await expect(chatInput(page)).toHaveValue('pregunta sin red');

    await context.setOffline(false);
    await expect(page.getByText(es.connection.chat)).toBeHidden();
    await expect(page.getByRole('button', { name: es.chat.send })).toBeEnabled();
    await expect(chatInput(page)).toHaveValue('pregunta sin red');
    // Nada salió hacia /v1/questions, ni antes ni después de reconectar.
    expect(mock.calls('POST', '/v1/questions')).toHaveLength(0);
  });
});

test.describe('Cuenta', () => {
  test('Descargar mis datos pide la exportación y descarga un archivo', async ({ page, mock }) => {
    await mock.signIn('email');
    await page.goto('/profile');
    const descarga = page.waitForEvent('download');
    await page.getByText(es.dataExport.title, { exact: true }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toBe('apuntor-mis-datos.json');
    expect(mock.calls('GET', '/v1/account/export')).toHaveLength(1);
    const ruta = await archivo.path();
    const { readFile } = await import('node:fs/promises');
    const contenido = await readFile(ruta, 'utf8');
    expect(contenido).toContain(EXPORT_DATA.user.email);
    await expect(page.getByText(es.dataExport.done)).toBeVisible();
  });

  test('borrar la cuenta: con correo pide contraseña y confirmación; con Google solo la palabra', async ({
    page,
    mock,
  }) => {
    const d = es.deleteAccount;
    await mock.signIn('email');
    await page.goto('/profile/delete-account');

    const borrar = page.getByRole('button', { name: d.submit });
    await expect(page.getByLabel(d.passwordLabel)).toBeVisible();
    await expect(borrar).toBeDisabled();
    await page.getByLabel(d.confirmLabel(d.confirmWord)).fill(d.confirmWord);
    await expect(borrar).toBeDisabled(); // falta la contraseña

    // Contraseña incorrecta: error y nada se borra.
    await page.getByLabel(d.passwordLabel).fill('clave-equivocada');
    await expect(borrar).toBeEnabled();
    await borrar.click();
    await expect(page.getByText(d.passwordError)).toBeVisible();
    expect(mock.calls('DELETE', '/v1/account')).toHaveLength(0);

    // Contraseña correcta: se borra y vuelve al inicio de sesión.
    await page.getByLabel(d.passwordLabel).fill(PASSWORD_OK);
    await borrar.click();
    await expect(page).toHaveURL(/\/login$/u);
    expect(mock.calls('DELETE', '/v1/account')).toHaveLength(1);
  });

  test('borrar la cuenta con Google no muestra el campo de contraseña', async ({ page, mock }) => {
    const d = es.deleteAccount;
    await mock.signIn('google');
    await page.goto('/profile/delete-account');

    const borrar = page.getByRole('button', { name: d.submit });
    await expect(page.getByLabel(d.confirmLabel(d.confirmWord))).toBeVisible();
    await expect(page.getByLabel(d.passwordLabel)).toHaveCount(0);
    await expect(borrar).toBeDisabled();
    await page.getByLabel(d.confirmLabel(d.confirmWord)).fill(d.confirmWord);
    await expect(borrar).toBeEnabled();
    expect(mock.calls('DELETE', '/v1/account')).toHaveLength(0);
  });
});
