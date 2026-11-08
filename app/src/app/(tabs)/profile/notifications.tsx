import { Banner, Screen, TopBar } from '@/components/ui';
import { useStrings } from '@/i18n/es';

/** Pantalla 34 · Ajustes de notificaciones: aún no existen, y la pantalla lo dice (fase 4). */
export default function NotificationSettings() {
  const s = useStrings();
  const n = s.notificationSettings;
  return (
    <Screen header={<TopBar title={n.header} />}>
      <Banner tone="info" icon="bell" title={n.soonTitle} body={n.soonBody} />
    </Screen>
  );
}
