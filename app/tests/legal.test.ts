import { describe, expect, it } from 'vitest';
import {
  LEGAL,
  LEGAL_UPDATED,
  LEGAL_VERSION,
  hasPlaceholders,
  type LegalDoc,
} from '../src/i18n/legal';

const DOCS: readonly LegalDoc[] = ['terms', 'privacy', 'subscription'];

describe('textos legales', () => {
  it('LEGAL_VERSION es una fecha ISO y hay fecha legible por idioma', () => {
    expect(LEGAL_VERSION).toBe('2026-11-08');
    expect(LEGAL_UPDATED.es.trim()).not.toBe('');
    expect(LEGAL_UPDATED.en.trim()).not.toBe('');
  });

  it.each(DOCS)('%s: español e inglés tienen las mismas secciones y párrafos', (doc) => {
    const es = LEGAL.es[doc];
    const en = LEGAL.en[doc];
    expect(es.length).toBeGreaterThan(0);
    expect(en.map((s) => s.paragraphs.length)).toEqual(es.map((s) => s.paragraphs.length));
  });

  it.each(DOCS)('%s: sin títulos ni párrafos vacíos', (doc) => {
    for (const lang of ['es', 'en'] as const) {
      for (const section of LEGAL[lang][doc]) {
        expect(section.title.trim()).not.toBe('');
        expect(section.paragraphs.length).toBeGreaterThan(0);
        for (const p of section.paragraphs) expect(p.trim()).not.toBe('');
      }
    }
  });

  it.each(['es', 'en'] as const)(
    'privacidad (%s) menciona a cada proveedor y los derechos ARCO',
    (lang) => {
      const text = LEGAL[lang].privacy.flatMap((s) => [s.title, ...s.paragraphs]).join('\n');
      for (const name of ['Supabase', 'Cloudflare', 'Google', 'Tavily', 'ARCO']) {
        expect(text).toContain(name);
      }
    },
  );

  it('el aviso de borrador se apoya en los datos por completar entre corchetes', () => {
    expect(hasPlaceholders([{ title: 'Pendiente', paragraphs: ['RUC [RUC]'] }])).toBe(true);
    expect(hasPlaceholders([{ title: 'Listo', paragraphs: ['Sin datos pendientes.'] }])).toBe(
      false,
    );
  });

  it('no quedan datos del responsable por completar en ningún texto publicado', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const doc of ['terms', 'privacy', 'subscription'] as const) {
        expect(hasPlaceholders(LEGAL[lang][doc]), `${lang}/${doc}`).toBe(false);
      }
    }
  });
});
