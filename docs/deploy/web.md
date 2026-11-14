# Publicar la web (apuntor.com)

La web sale de `app/` (Expo exportado) y se sirve con un Worker de Cloudflare. Esta guía explica
qué hay publicado, cómo funciona y los pasos que hace el titular en Cloudflare, Search Console y
Google para que Google apruebe la marca de la pantalla de consentimiento y el sitio se indexe.

## 1. Qué se publica

| Ruta                                  | Qué es                                                 | Google lo indexa |
| ------------------------------------- | ------------------------------------------------------ | ---------------- |
| `/`                                   | Landing pública, HTML estático (sin JavaScript)        | Sí               |
| `/legal/privacy`, `/legal/terms`      | Política de privacidad y Términos, HTML estático       | Sí               |
| `/login`, `/home`, `/courses/…`, etc. | La app (SPA de Expo). Cabecera `X-Robots-Tag: noindex` | No               |
| `/robots.txt`, `/sitemap.xml`         | Archivos estáticos                                     | —                |
| `/_expo/*`, `/assets/*`               | Código y recursos de la app                            | —                |
| Cualquier otra ruta                   | Página 404 real (código 404, no cae a la app)          | No               |
| `www.apuntor.com/…`                   | Redirección 301 a `https://apuntor.com/…` (misma ruta) | —                |

Cómo funciona:

- `app/wrangler.jsonc` declara el Worker (`main: ./worker/index.ts`) y el binding `ASSETS` sobre
  `./dist`. El comando de build en Cloudflare no cambia: desde `app/`,
  `npx expo export --platform web` y luego `npx wrangler deploy`.
- Expo copia `app/public/` a `dist/`: ahí están `landing.html`, `404.html`, `legal/*.html`,
  `robots.txt`, `sitemap.xml`, el ícono y el favicon.
- La decisión de qué servir en cada ruta está en `app/worker/routing.ts` (función pura, con tests
  en `app/tests/worker-routing.test.ts`). `app/worker/index.ts` solo la aplica. Si agregas una
  pantalla nueva en `app/src/app/`, el test falla hasta que la añadas a `APP_ROUTES`.
- Los archivos de Expo (`/_expo/*`, `/assets/*`) se sirven directo, sin pasar por el Worker.
- Si el regreso de Google o del correo cae en `/?code=…` o `/?error=…`, el Worker lo manda a
  `/auth-callback` con la misma query.

### Textos legales

`app/public/legal/privacy.html` y `terms.html` se generan desde `app/src/i18n/legal.ts` (español),
así son idénticos a los de la app. Si cambias el texto legal:

```bash
npm run legal:html     # desde la raíz; regenera app/public/legal/*.html
```

y commitea los archivos. Un test (`app/tests/public-pages.test.ts`) falla si quedan desactualizados.
Recuerda subir `LEGAL_VERSION` y `LEGAL_UPDATED`, y copiar el cambio a `docs/legal/*.md`.

## 2. Cloudflare

1. **DNS → borrar el registro viejo**: en la zona `apuntor.com`, elimina el registro `A` de `www`
   que apunta a `208.91.197.27`. Si queda, Cloudflare no deja crear el dominio personalizado.
2. **Workers & Pages → `apuntor` → Settings → Domains & Routes → Add → Custom domain**: agrega
   `apuntor.com` y luego `www.apuntor.com`. Cloudflare crea los registros DNS y los certificados.
3. Despliega el cambio (merge a la rama que publica Cloudflare). Cuando termine el build,
   comprueba:
   - `https://apuntor.com/` muestra la landing.
   - `https://www.apuntor.com/legal/privacy` redirige a `https://apuntor.com/legal/privacy`.
   - `https://apuntor.com/robots.txt` y `https://apuntor.com/sitemap.xml` devuelven texto y XML.
   - `https://apuntor.com/login` abre la app; `https://apuntor.com/cualquier-cosa` da 404.
4. Si ya había una redirección o regla de `www` en Cloudflare (Rules → Redirect Rules), bórrala:
   ahora la hace el Worker.

## 3. Google Search Console

1. En https://search.google.com/search-console agrega una propiedad de tipo **Dominio**:
   `apuntor.com`.
2. Google da un registro **TXT**. Agrégalo en Cloudflare (DNS → Add record → tipo `TXT`, nombre
   `@`, el valor que te muestra Google) y pulsa **Verificar**.
3. **Sitemaps** → escribe `sitemap.xml` → **Enviar**. Debe listar 3 URL.
4. **Inspección de URL**: pega `https://apuntor.com/` → **Solicitar indexación**. Haz lo mismo
   con `https://apuntor.com/legal/privacy` y `https://apuntor.com/legal/terms`.

La indexación puede tardar de días a semanas; la verificación de marca de Google no la necesita.

## 4. Google Auth Platform (pantalla de consentimiento)

En https://console.cloud.google.com → **Google Auth Platform** del proyecto de APUNTOR:

1. **Branding**:
   - Nombre de la aplicación: exactamente `Apuntor`.
   - Correo de asistencia y correo de contacto del desarrollador: `soporte@apuntor.com`.
   - Logotipo: el ícono de `app/assets/icon.png`.
   - Página principal: `https://apuntor.com/`
   - Política de privacidad: `https://apuntor.com/legal/privacy`
   - Términos del servicio: `https://apuntor.com/legal/terms`
   - **Dominios autorizados**: `apuntor.com`.
2. **Acceso a los datos** (Data Access): solo los permisos `openid`, `email` y `profile`
   (`.../auth/userinfo.email` y `.../auth/userinfo.profile`). No agregues otros. Son permisos no
   sensibles, así que no hace falta verificación de permisos, solo la de marca.
3. **Público** (Audience): pasa el **estado de publicación** de _Pruebas_ a **En producción**
   (_Publicar aplicación_ → Confirmar).
4. **Centro de verificación** (Verification Center): abre el aviso de la marca, pulsa
   **Corregí los problemas** y luego **Continuar** para volver a enviar la verificación. Google
   responde por correo; suele tardar unos días.

La landing y la política de privacidad cumplen lo que Google revisa: la página principal es
pública, describe la app, enlaza a la política y a los términos, y la política explica qué datos
de Google se usan (correo, nombre y foto de perfil) y para qué.

## 5. Aviso: los usuarios deben aceptar de nuevo

Se agregó a la política de privacidad el detalle de los datos de Google y se subió `LEGAL_VERSION`
a `2026-11-14`. Quien ya tenía cuenta (incluido el titular) verá la pantalla de aceptación de los
Términos y la Política la próxima vez que entre.

## 6. Comprobaciones antes de enviar a Google

- Abre la landing en el celular y en modo oscuro; el botón **Entrar** lleva a `/login`.
- `curl -I https://apuntor.com/login` incluye `x-robots-tag: noindex`.
- En Supabase (Authentication → URL Configuration), la URL del sitio y las redirecciones
  permitidas deben incluir `https://apuntor.com/auth-callback` y `https://apuntor.com/reset-password`.
  El Worker no las cambia; solo conviene confirmar que siguen ahí.
