import { ComingSoon } from '@/components/domain/ComingSoon';
import { useStrings } from '@/i18n/es';

/** Pantalla 5 · Chat — pendiente de diseño. */
export default function Chat() {
  return <ComingSoon title={useStrings().placeholder.chat} />;
}
