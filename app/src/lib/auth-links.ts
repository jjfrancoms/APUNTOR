import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Rutas de la app a las que vuelve Supabase (deben estar en sus Redirect URLs). */
export type AuthReturnRoute = 'reset-password' | 'auth-callback';

/** En web, Supabase redirige la pestaña completa; en el teléfono se abre una sesión de navegador. */
export const usesBrowserRedirect = Platform.OS === 'web';

/**
 * URL de regreso hecha con expo-linking: en web `https://<sitio>/reset-password`, en Expo Go
 * `exp://<ip>:8081/--/reset-password` y en una build propia `apuntor://reset-password`.
 */
export function authReturnUrl(route: AuthReturnRoute): string {
  return Linking.createURL(route);
}

/** Abre el inicio de sesión del proveedor y devuelve la URL de regreso, o null si se canceló. */
export async function openAuthSession(url: string, returnUrl: string): Promise<string | null> {
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  return 'url' in result ? result.url : null;
}
