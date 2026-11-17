export const BOLIVIA_TIME_ZONE = 'America/La_Paz';

/** Fecha actual en ISO 8601 UTC. Toda fecha persistida usa este formato. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Muestra una fecha ISO en hora local de Bolivia. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: BOLIVIA_TIME_ZONE
  }).format(new Date(iso));
}

/** Muestra solo la hora local de Bolivia. */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    timeStyle: 'short',
    timeZone: BOLIVIA_TIME_ZONE
  }).format(new Date(iso));
}

/** Año local de Bolivia, usado para folios legibles. */
export function boliviaYear(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    timeZone: BOLIVIA_TIME_ZONE
  }).formatToParts(date);

  return parts.find((part) => part.type === 'year')?.value ?? String(date.getUTCFullYear());
}
