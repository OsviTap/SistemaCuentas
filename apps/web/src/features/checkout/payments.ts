/**
 * Construcción y validación de pagos de una venta.
 * Regla central: la suma de los pagos debe ser exactamente el total.
 */

export type PaymentMethod = 'cash' | 'qr' | 'mixed';

export type CashPaymentInput = {
  method: 'cash';
  amountCents: number;
  cashReceivedCents: number;
  changeCents: number;
};

export type QrPaymentInput = {
  method: 'qr';
  amountCents: number;
  qrReference: string;
};

export type SalePaymentInput = CashPaymentInput | QrPaymentInput;

export type PaymentDraft = {
  method: PaymentMethod;
  /** Efectivo recibido en modo efectivo puro. */
  cashReceivedCents: number;
  /** Parte aplicada en efectivo en modo mixto. */
  cashCents: number;
  /** Parte aplicada por QR en modo mixto. */
  qrCents: number;
  qrReference: string;
};

export type PaymentValidation =
  | { ok: true; payments: SalePaymentInput[]; changeCents: number }
  | { ok: false; error: string };

export const MIN_QR_REFERENCE_LENGTH = 4;
export const MAX_QR_REFERENCE_LENGTH = 40;

export function normalizeQrReference(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function validateQrReference(value: string): string | null {
  const normalized = normalizeQrReference(value);
  if (normalized.length < MIN_QR_REFERENCE_LENGTH) {
    return `La referencia QR debe tener al menos ${MIN_QR_REFERENCE_LENGTH} caracteres.`;
  }
  if (normalized.length > MAX_QR_REFERENCE_LENGTH) {
    return `La referencia QR no puede superar ${MAX_QR_REFERENCE_LENGTH} caracteres.`;
  }
  return null;
}

export function buildPayments(
  draft: PaymentDraft,
  totalCents: number
): PaymentValidation {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    return { ok: false, error: 'El total de la venta debe ser mayor que cero.' };
  }

  if (draft.method === 'cash') {
    if (!Number.isInteger(draft.cashReceivedCents) || draft.cashReceivedCents < 0) {
      return { ok: false, error: 'El efectivo recibido no es válido.' };
    }
    if (draft.cashReceivedCents < totalCents) {
      return { ok: false, error: 'El efectivo recibido no alcanza para cubrir el total.' };
    }
    return {
      ok: true,
      changeCents: draft.cashReceivedCents - totalCents,
      payments: [
        {
          method: 'cash',
          amountCents: totalCents,
          cashReceivedCents: draft.cashReceivedCents,
          changeCents: draft.cashReceivedCents - totalCents
        }
      ]
    };
  }

  if (draft.method === 'qr') {
    const referenceError = validateQrReference(draft.qrReference);
    if (referenceError) return { ok: false, error: referenceError };
    return {
      ok: true,
      changeCents: 0,
      payments: [
        {
          method: 'qr',
          amountCents: totalCents,
          qrReference: normalizeQrReference(draft.qrReference)
        }
      ]
    };
  }

  const cashCents = draft.cashCents;
  const qrCents = draft.qrCents;

  if (!Number.isInteger(cashCents) || cashCents <= 0) {
    return { ok: false, error: 'La parte en efectivo debe ser mayor que cero.' };
  }
  if (!Number.isInteger(qrCents) || qrCents <= 0) {
    return { ok: false, error: 'La parte por QR debe ser mayor que cero.' };
  }
  if (cashCents + qrCents !== totalCents) {
    return {
      ok: false,
      error: 'La suma de efectivo y QR debe ser exactamente el total.'
    };
  }

  const referenceError = validateQrReference(draft.qrReference);
  if (referenceError) return { ok: false, error: referenceError };

  return {
    ok: true,
    changeCents: 0,
    payments: [
      {
        method: 'cash',
        amountCents: cashCents,
        cashReceivedCents: cashCents,
        changeCents: 0
      },
      {
        method: 'qr',
        amountCents: qrCents,
        qrReference: normalizeQrReference(draft.qrReference)
      }
    ]
  };
}
