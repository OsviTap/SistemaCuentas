/**
 * Utilidades de dinero. Todos los montos son enteros de centavos (BOB).
 * Nunca se usan decimales flotantes para representar dinero.
 */

/** Límite operativo: Bs 999.999,99. Evita desbordes y errores de tecleo. */
export const MAX_AMOUNT_CENTS = 99_999_999;

/** Denominaciones de Bolivia en centavos, de mayor a menor. */
export const BOB_DENOMINATIONS = [
  20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50, 20, 10
] as const;

function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Formatea centavos como monto sin símbolo: 123456 → "1.234,56". */
export function formatAmount(cents: number): string {
  const safe = Math.trunc(cents);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const units = Math.floor(abs / 100);
  const decimals = abs % 100;
  return `${sign}${groupThousands(units)},${String(decimals).padStart(2, '0')}`;
}

/** Formatea centavos con símbolo: 123456 → "Bs 1.234,56". */
export function formatBs(cents: number): string {
  const safe = Math.trunc(cents);
  const sign = safe < 0 ? '-' : '';
  return `${sign}Bs ${formatAmount(Math.abs(safe))}`;
}

export function isValidAmount(cents: number): boolean {
  return Number.isInteger(cents) && cents >= 0 && cents <= MAX_AMOUNT_CENTS;
}

/** Agrega un dígito al final del monto. Ignora la tecla si desborda el límite. */
export function appendDigit(valueCents: number, digit: number): number {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new Error(`Dígito inválido: ${digit}`);
  }
  const next = valueCents * 10 + digit;
  return next > MAX_AMOUNT_CENTS ? valueCents : next;
}

/** Agrega dos ceros al final del monto. Ignora la tecla si desborda el límite. */
export function appendDoubleZero(valueCents: number): number {
  const next = valueCents * 100;
  return next > MAX_AMOUNT_CENTS ? valueCents : next;
}

/** Borra el último dígito del monto. */
export function removeLastDigit(valueCents: number): number {
  return Math.floor(valueCents / 10);
}

export type ChangeResult =
  | { status: 'missing'; missingCents: number; changeCents: 0 }
  | { status: 'paid'; missingCents: 0; changeCents: number };

/** Calcula el cambio de un pago en efectivo. */
export function calculateChange(
  totalCents: number,
  receivedCents: number
): ChangeResult {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error(`Total inválido: ${totalCents}`);
  }
  if (!Number.isInteger(receivedCents) || receivedCents < 0) {
    throw new Error(`Monto recibido inválido: ${receivedCents}`);
  }

  const difference = receivedCents - totalCents;

  if (difference < 0) {
    return { status: 'missing', missingCents: -difference, changeCents: 0 };
  }

  return { status: 'paid', missingCents: 0, changeCents: difference };
}

export type DenominationPart = { valueCents: number; count: number };

export type ChangeBreakdown = {
  parts: DenominationPart[];
  /** Centavos que no se pueden cubrir con las denominaciones disponibles. */
  remainderCents: number;
};

/** Sugiere cómo entregar el cambio con la menor cantidad de piezas. */
export function breakdownChange(
  changeCents: number,
  denominations: readonly number[] = BOB_DENOMINATIONS
): ChangeBreakdown {
  if (!Number.isInteger(changeCents) || changeCents < 0) {
    throw new Error(`Cambio inválido: ${changeCents}`);
  }

  let remaining = changeCents;
  const parts: DenominationPart[] = [];

  for (const valueCents of denominations) {
    if (valueCents <= 0) continue;
    const count = Math.floor(remaining / valueCents);
    if (count > 0) {
      parts.push({ valueCents, count });
      remaining -= count * valueCents;
    }
  }

  return { parts, remainderCents: remaining };
}
