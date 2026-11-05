import { Redirect } from 'expo-router';
import { useStore } from '@/store/store';

// Con sesión → Inicio; sin sesión → Inicio de sesión. La vista previa publicada abre el mapa.
export default function Index() {
  const signedIn = useStore((s) => s.session !== null);
  if (process.env.EXPO_PUBLIC_PREVIEW === '1') return <Redirect href="/mapa" />;
  return <Redirect href={signedIn ? '/home' : '/login'} />;
}
