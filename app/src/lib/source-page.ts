import { router } from 'expo-router';
import { Linking } from 'react-native';
import { api } from '@/lib/api';

/**
 * Abre una página del original para comprobar una cita (la imagen de la página, en PDF). Si el
 * documento no tiene páginas dibujadas, abre su detalle.
 */
export async function openSourcePage(documentId: string, page: number): Promise<void> {
  try {
    const { url } = await api.page(documentId, page);
    await Linking.openURL(url);
  } catch {
    router.push(`/documents/${documentId}`);
  }
}
