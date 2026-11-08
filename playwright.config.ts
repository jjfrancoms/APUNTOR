import { defineConfig, devices } from '@playwright/test';

const PORT = 8090;

/** Variables del servidor web: la app apunta a hosts FALSOS. El entorno del proceso manda sobre app/.env. */
const appEnv: Record<string, string> = {
  EXPO_PUBLIC_API_URL: 'http://api.e2e.test',
  EXPO_PUBLIC_SUPABASE_URL: 'http://supabase.e2e.test',
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_clave_falsa',
  EXPO_PUBLIC_GOOGLE_AUTH: '0',
  EXPO_PUBLIC_PREVIEW: '0',
  // En modo desarrollo Expo mezcla app/.env.local ENCIMA del entorno del proceso (en el navegador
  // ganan los archivos .env). Con --no-dev las variables se incrustan al compilar y gana el entorno.
  EXPO_NO_DOTENV: '1',
  CI: '1',
  BROWSER: 'none',
  EXPO_NO_TELEMETRY: '1',
};

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-PE',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // Solo los escenarios marcados con @telefono, en un ancho de 390 px.
      name: 'telefono',
      grep: /@telefono/u,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    // --clear: el caché de Metro no debe traer variables EXPO_PUBLIC de otra ejecución.
    command: `npx expo start --web --port ${PORT} --no-dev --clear`,
    cwd: 'app',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: appEnv,
  },
});
