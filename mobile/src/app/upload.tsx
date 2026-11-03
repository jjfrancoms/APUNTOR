import { ComingSoon } from '@/components/domain/ComingSoon';
import { useStrings } from '@/i18n/es';

/** Pantalla 2 · Subir documentos — se construye en la siguiente entrega (grupo 2). */
export default function Upload() {
  return <ComingSoon title={useStrings().placeholder.upload} withBack />;
}
