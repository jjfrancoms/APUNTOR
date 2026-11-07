import { describe, expect, it } from 'vitest';
import { es } from '../src/i18n/es';
import { failureTitle } from '../src/lib/upload-view';

describe('título del motivo de una subida fallida', () => {
  it('un archivo que no se pudo procesar no se muestra como formato no compatible', () => {
    expect(failureTitle('UP_UNREADABLE', es)).toBe(es.uploadProblems.unreadableTitle);
    expect(failureTitle('UP_FORMAT', es)).toBe(es.uploadProblems.formatTitle);
  });
});
