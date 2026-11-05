import * as DocumentPicker from 'expo-document-picker';
import { fileFromPicker, type PickedFile } from '@/store/store';

/** Abre el selector de archivos del sistema (también funciona en web). */
export async function pickFiles(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: false,
  });
  if (result.canceled) return [];
  return result.assets.map(fileFromPicker);
}

/** Archivos de ejemplo para probar todos los caminos sin tener archivos a mano. */
export const SAMPLE_FILES: PickedFile[] = [
  { name: 'Apuntes de Cálculo I.pdf', sizeMb: 2.4 },
  { name: 'Física II.pptx', sizeMb: 8.1 },
  { name: 'Foto de pizarra.jpg', sizeMb: 1.2 },
  { name: 'Ensayo final.docx', sizeMb: 0.9 },
  { name: 'Examen final.rar', sizeMb: 3 },
  { name: 'Clase grabada.mp4', sizeMb: 212 },
  { name: 'Resumen_chino.pdf', sizeMb: 1.1 },
];
