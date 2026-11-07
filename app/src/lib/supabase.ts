import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { authStorage } from './auth-storage';
import { config } from './config';

// Sin configuración se usa una URL válida que nunca responde: la app muestra el aviso
// de configuración en lugar de fallar al importar este módulo.
export const supabase = createClient(
  config.supabaseUrl || 'http://localhost:54321',
  config.supabaseKey || 'sin-configurar',
  {
    auth: {
      ...(authStorage ? { storage: authStorage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      // PKCE: los enlaces del correo y el regreso de Google traen `?code=`, que la app cambia
      // por la sesión con exchangeCodeForSession (reset-password y auth-callback).
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  },
);

// En el teléfono, el refresco de la sesión solo corre con la app en primer plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
