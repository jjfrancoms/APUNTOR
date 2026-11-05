// Importa solo los pesos usados (el índice del paquete incluye los 14).
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebChrome } from '@/components/web/WebChrome';
import { LanguageProvider } from '@/i18n/language';
import { hydrate, useStore } from '@/store/store';
import { ThemeProvider, useTheme } from '@/theme';

/** Aplica la apariencia elegida en Perfil (automática, clara u oscura). */
function ThemedApp() {
  const pref = useStore((st) => st.settings.theme);
  const language = useStore((st) => st.settings.language);
  return (
    <LanguageProvider language={language}>
      <ThemeProvider mode={pref === 'system' ? undefined : pref}>
        <Root />
      </ThemeProvider>
    </LanguageProvider>
  );
}

function Root() {
  const { c, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <WebChrome />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Carga los datos guardados en el dispositivo (o los de prueba) antes de mostrar la app.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void hydrate().finally(() => setReady(true));
  }, []);
  if (!loaded || !ready) return null;
  return (
    <SafeAreaProvider>
      <ThemedApp />
    </SafeAreaProvider>
  );
}
