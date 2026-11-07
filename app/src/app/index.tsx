import { Redirect } from 'expo-router';
import { entryRoute, useStore } from '@/store/store';

// Con sesión → Inicio (o la confirmación de edad si entró con Google y aún no la dio);
// sin sesión → Inicio de sesión. La vista previa publicada abre el mapa.
export default function Index() {
  const target = useStore(entryRoute);
  if (process.env.EXPO_PUBLIC_PREVIEW === '1') return <Redirect href="/mapa" />;
  return <Redirect href={target} />;
}
