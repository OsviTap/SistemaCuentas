import { describe, expect, it } from 'vitest';
import { normalizeSearchName } from './search';

describe('normalizeSearchName', () => {
  it('quita acentos, mayúsculas y espacios extra', () => {
    expect(normalizeSearchName('  Café   con Leche  ')).toBe('cafe con leche');
    expect(normalizeSearchName('PAN DE QUESO')).toBe('pan de queso');
    expect(normalizeSearchName('Añejo')).toBe('anejo');
  });

  it('descarta signos que no ayudan a buscar', () => {
    expect(normalizeSearchName('Refresco 1,5 L')).toBe('refresco 1 5 l');
    expect(normalizeSearchName('***')).toBe('');
  });
});
