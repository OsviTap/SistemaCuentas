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
