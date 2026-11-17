/**
 * Normaliza nombres para búsqueda local: minúsculas, sin acentos y con
 * espacios simples. Se guarda en `searchName` para no repetir el trabajo.
 */
export function normalizeSearchName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
