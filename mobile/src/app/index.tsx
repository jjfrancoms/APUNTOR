import { Redirect } from 'expo-router';

// Sin backend todavía: la app arranca en Inicio de sesión (pantalla 1).
export default function Index() {
  return <Redirect href="/login" />;
}
