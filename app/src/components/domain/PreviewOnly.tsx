import type { ComponentType } from 'react';
import { useStrings } from '@/i18n/es';
import { PREVIEW } from '@/lib/config';
import { ComingSoon } from './ComingSoon';

/**
 * Pantallas de fases siguientes (estudio, planes, escáner, compartir) y estados de
 * demostración: muestran datos de ejemplo, así que solo se ven en la vista previa del
 * diseño. En la app real dicen "Muy pronto".
 */
export function previewOnly<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  function Gate(props: P) {
    const s = useStrings();
    if (!PREVIEW) return <ComingSoon title={s.live.soonTitle} withBack />;
    return <Screen {...props} />;
  }
  Gate.displayName = `PreviewOnly(${Screen.displayName ?? Screen.name})`;
  return Gate;
}
