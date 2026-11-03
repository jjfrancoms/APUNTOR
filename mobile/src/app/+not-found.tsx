import { Redirect } from 'expo-router';

// Ruta desconocida → inicio de sesión. En la vista previa publicada (EXPO_PUBLIC_PREVIEW=1)
// abre el mapa de pantallas, para revisar todas desde un solo lugar.
export default function NotFound() {
  return <Redirect href={process.env.EXPO_PUBLIC_PREVIEW === '1' ? '/mapa' : '/login'} />;
}
