# Publicar el servidor en Railway

La API y el worker son dos servicios de Railway que salen del mismo repositorio. Base de datos
(Supabase), archivos (Cloudflare R2) e IA (Google) ya están en la nube.

## 1. Proyecto y servicios

1. En https://railway.com crea un proyecto con **Deploy from GitHub repo** y elige `APUNTOR`.
2. El primer servicio será la **API**. En _Settings_:
   - **Branch**: la rama publicada (por ahora `main`).
   - **Root Directory**: vacío (raíz del repositorio). La app de `app/` no se instala ahí.
   - **Start Command**: `npm start` (arranca la API; si lo dejas vacío, Railway usa este mismo)
   - **Healthcheck Path**: `/health`
3. Agrega un segundo servicio desde el mismo repositorio para el **worker**:
   - **Start Command**: `npm run start:worker` (obligatorio: sin él, este servicio arrancaría la API)
   - Sin dominio público ni healthcheck: no recibe peticiones, solo procesa la cola.

Node se fija con `.nvmrc` (22) y `engines` en `package.json`. No hay paso de build: los
servicios corren TypeScript con `tsx`.

## 2. Variables

En cada servicio, _Variables_ → **Raw Editor**, pega las mismas variables de `APUNTOR/.env`
(ver `.env.example`). Diferencias respecto de la laptop:

- `PORT`: no la pongas; Railway la asigna sola.
- `CORS_ORIGINS=https://apuntor.com,https://www.apuntor.com`
- IA: mientras no haya facturación, `GEMINI_API_KEY` y `GENERATION_MODEL`. Con Vertex AI en la
  nube hace falta una cuenta de servicio (no sirve el login de `gcloud` de la laptop).

Las claves viven solo en Railway y en `.env` local; nunca en el repositorio.

## 3. Dominio `api.apuntor.com`

1. En la API: _Settings_ → _Networking_ → **Custom Domain** → `api.apuntor.com`. Railway muestra
   un destino CNAME.
2. En Cloudflare → DNS → **Add record**: tipo `CNAME`, nombre `api`, destino el que dio Railway,
   proxy **Solo DNS** (nube gris) hasta que Railway emita el certificado.
3. Comprueba `https://api.apuntor.com/health` → `{"status":"ok"}`.
4. En `app/.env` (y en el build web): `EXPO_PUBLIC_API_URL=https://api.apuntor.com`.

## 4. Después de publicar

- `trustProxy` ya cuenta con un salto de proxy (el de Railway) para el límite de peticiones.
- El límite de peticiones se cuenta por proceso: con una sola réplica de la API es exacto.
