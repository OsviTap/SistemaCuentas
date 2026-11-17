import { describe, expect, it } from 'vitest';
import {
  buildPayments,
  normalizeQrReference,
  validateQrReference,
  type PaymentDraft
} from './payments';

const baseDraft: PaymentDraft = {
  method: 'cash',
  cashReceivedCents: 0,
  cashCents: 0,
  qrCents: 0,
  qrReference: ''
};

describe('validateQrReference', () => {
  it('exige al menos 4 caracteres', () => {
    expect(validateQrReference('')).not.toBeNull();
    expect(validateQrReference('123')).not.toBeNull();
    expect(validateQrReference('1234')).toBeNull();
  });

  it('ignora espacios al medir', () => {
    expect(validateQrReference('  12  ')).not.toBeNull();
    expect(validateQrReference('  ab12  ')).toBeNull();
  });
});

describe('normalizeQrReference', () => {
  it('recorta, colapsa espacios y pasa a mayúsculas', () => {
    expect(normalizeQrReference('  ab  12  ')).toBe('AB 12');
  });
});

describe('buildPayments en efectivo', () => {
  it('calcula el cambio y registra el monto recibido', () => {
    const result = buildPayments(
      { ...baseDraft, method: 'cash', cashReceivedCents: 10_000 },
      7000
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changeCents).toBe(3000);
    expect(result.payments).toEqual([
      {
        method: 'cash',
        amountCents: 7000,
        cashReceivedCents: 10_000,
        changeCents: 3000
      }
    ]);
  });

  it('rechaza efectivo insuficiente', () => {
    const result = buildPayments(
      { ...baseDraft, method: 'cash', cashReceivedCents: 5000 },
      7000
    );
    expect(result.ok).toBe(false);
  });

  it('rechaza un total de cero', () => {
    const result = buildPayments({ ...baseDraft, method: 'cash' }, 0);
    expect(result.ok).toBe(false);
  });
});

describe('buildPayments por QR', () => {
  it('exige referencia válida', () => {
    const result = buildPayments(
      { ...baseDraft, method: 'qr', qrReference: '12' },
      5000
    );
    expect(result.ok).toBe(false);
  });

  it('normaliza la referencia', () => {
    const result = buildPayments(
      { ...baseDraft, method: 'qr', qrReference: ' ab12 ' },
      5000
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payments).toEqual([
      { method: 'qr', amountCents: 5000, qrReference: 'AB12' }
    ]);
  });
});

describe('buildPayments mixto', () => {
  it('genera dos pagos separados que suman el total', () => {
    const result = buildPayments(
      {
        ...baseDraft,
        method: 'mixed',
        cashCents: 3000,
        qrCents: 4000,
        qrReference: 'ab12'
      },
      7000
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payments).toHaveLength(2);
    expect(result.payments[0]).toMatchObject({ method: 'cash', amountCents: 3000 });
    expect(result.payments[1]).toMatchObject({
      method: 'qr',
      amountCents: 4000,
      qrReference: 'AB12'
    });
  });

  it('rechaza una suma que no coincide con el total', () => {
    const result = buildPayments(
      {
        ...baseDraft,
        method: 'mixed',
        cashCents: 3000,
        qrCents: 3000,
        qrReference: 'ab12'
      },
      7000
    );
    expect(result.ok).toBe(false);
  });

  it('rechaza una parte en cero', () => {
    const result = buildPayments(
      {
        ...baseDraft,
        method: 'mixed',
        cashCents: 7000,
        qrCents: 0,
        qrReference: 'ab12'
      },
      7000
    );
    expect(result.ok).toBe(false);
  });
});
