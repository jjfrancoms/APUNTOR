/**
 * Calienta el empaquetador de Expo antes de los tests: la primera compilación tarda y, sin esto,
 * se la llevaría el primer test (y fallaría por tiempo).
 */
import { FAKE_API_URL, FAKE_SUPABASE_URL } from './fixtures';

export default async function globalSetup(): Promise<void> {
  const base = 'http://localhost:8090';
  const html = await (await fetch(base)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gu)].map((m) => m[1] ?? '');
  for (const src of scripts) {
    const response = await fetch(new URL(src, base));
    const code = await response.text();
    // Comprobación de seguridad: el paquete debe apuntar a los hosts falsos y a ningún otro.
    const esPaqueteDeLaApp = src.includes('entry.bundle');
    if (!esPaqueteDeLaApp) continue;
    if (!code.includes(FAKE_API_URL) || !code.includes(FAKE_SUPABASE_URL)) {
      throw new Error('La app no usa los hosts falsos de las pruebas: revisa el entorno de Expo.');
    }
    // En modo desarrollo Expo mezcla app/.env.local encima del entorno del proceso.
    if (/EXPO_PUBLIC_API_URL"\s*:\s*"/u.test(code)) {
      throw new Error('El paquete incluye una EXPO_PUBLIC_API_URL de app/.env*: usa --no-dev.');
    }
  }
}
