import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useWindowDimensions } from 'react-native';
import { TabBar } from '@/components/navigation/TabBar';
import { PREVIEW } from '@/lib/config';
import { needsAdultCheck, needsConsent, useStore } from '@/store/store';
import { useTheme, navigationLayoutFor } from '@/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const vertical = navigationLayoutFor(width) !== 'bottom-bar';
  // Quien entró con Google sin confirmar su mayoría de edad no pasa a la app.
  const pendingAge = useStore(needsAdultCheck);
  // Ni quien no aceptó los Términos y la Política vigentes (si el servidor no responde, se
  // deja pasar y Inicio muestra el error de sincronización).
  const pendingConsent = useStore(needsConsent);
  if (pendingAge && !PREVIEW) return <Redirect href="/confirm-age" />;
  if (pendingConsent && !PREVIEW) return <Redirect href="/privacy" />;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: vertical ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="courses" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
