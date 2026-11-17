import { ulid } from 'ulid';

/** Genera un identificador ULID local, ordenable por tiempo. */
export function newId(): string {
  return ulid();
}
