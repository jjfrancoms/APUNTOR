import { Redirect } from 'expo-router';

// Cualquier ruta desconocida (o la URL de una vista previa publicada) lleva al inicio.
export default function NotFound() {
  return <Redirect href="/login" />;
}
