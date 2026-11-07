/**
 * Configuración pública de la app. Expo incrusta las variables EXPO_PUBLIC_ al compilar
 * (app/.env): aquí solo van datos públicos. Las claves secretas viven en el servidor.
 */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/u, ''),
};

/** true si la app sabe a qué servidor conectarse. */
export const backendConfigured =
  config.supabaseUrl.length > 0 && config.supabaseKey.length > 0 && config.apiUrl.length > 0;

/** Vista previa del diseño (mapa de pantallas con datos de ejemplo), nunca la app real. */
export const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

/**
 * Inicio con Google (Supabase OAuth). Apagado hasta configurar el proveedor en Supabase:
 * EXPO_PUBLIC_GOOGLE_AUTH=1 muestra el botón en Inicio de sesión y Registro.
 */
export const GOOGLE_AUTH = process.env.EXPO_PUBLIC_GOOGLE_AUTH === '1';
