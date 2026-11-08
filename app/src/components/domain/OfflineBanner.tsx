import { Banner } from '@/components/ui';
import { useOnline } from '@/lib/online';

/** Aviso de "sin conexión" que aparece y desaparece solo según el estado de la red. */
export function OfflineBanner({ title }: { title: string }) {
  const online = useOnline();
  if (online) return null;
  return <Banner tone="warning" icon="wifi-off" title={title} />;
}
