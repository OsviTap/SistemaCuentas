import { describe, expect, it } from 'vitest';
import {
  appendDigit,
  appendDoubleZero,
  breakdownChange,
  calculateChange,
  formatAmount,
  formatBs,
  isValidAmount,
  MAX_AMOUNT_CENTS,
  removeLastDigit
} from './money';

describe('formatAmount', () => {
  it('formatea centavos con separador de miles y coma decimal', () => {
    expect(formatAmount(0)).toBe('0,00');
    expect(formatAmount(5)).toBe('0,05');
    expect(formatAmount(50)).toBe('0,50');
    expect(formatAmount(500)).toBe('5,00');
    expect(formatAmount(123456)).toBe('1.234,56');
    expect(formatAmount(99_999_999)).toBe('999.999,99');
  });

  it('formatea montos negativos', () => {
    expect(formatAmount(-500)).toBe('-5,00');
  });
});

describe('formatBs', () => {
  it('antepone el símbolo del boliviano', () => {
    expect(formatBs(0)).toBe('Bs 0,00');
    expect(formatBs(700)).toBe('Bs 7,00');
    expect(formatBs(123456)).toBe('Bs 1.234,56');
  });

  it('ubica el signo antes del símbolo', () => {
    expect(formatBs(-2500)).toBe('-Bs 25,00');
  });
});

describe('isValidAmount', () => {
  it('acepta enteros dentro del rango', () => {
    expect(isValidAmount(0)).toBe(true);
    expect(isValidAmount(MAX_AMOUNT_CENTS)).toBe(true);
  });

  it('rechaza decimales, negativos y montos fuera de rango', () => {
    expect(isValidAmount(10.5)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(MAX_AMOUNT_CENTS + 1)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
  });
});

describe('teclado de montos', () => {
  it('agrega dígitos como centavos', () => {
    let value = 0;
    for (const digit of [1, 2, 3, 4]) value = appendDigit(value, digit);
    expect(value).toBe(1234);
    expect(formatAmount(value)).toBe('12,34');
  });

  it('ignora el dígito que desborda el límite', () => {
    expect(appendDigit(MAX_AMOUNT_CENTS, 9)).toBe(MAX_AMOUNT_CENTS);
  });

  it('agrega dos ceros', () => {
    expect(appendDoubleZero(5)).toBe(500);
    expect(appendDoubleZero(0)).toBe(0);
  });

  it('borra el último dígito', () => {
    expect(removeLastDigit(1234)).toBe(123);
    expect(removeLastDigit(1)).toBe(0);
  });
});

describe('calculateChange', () => {
  it('devuelve el cambio exacto', () => {
    expect(calculateChange(7000, 10_000)).toEqual({
      status: 'paid',
      missingCents: 0,
      changeCents: 3000
    });
  });

  it('marca pago exacto sin cambio', () => {
    expect(calculateChange(7000, 7000)).toEqual({
      status: 'paid',
      missingCents: 0,
      changeCents: 0
    });
  });

  it('informa cuánto falta', () => {
    expect(calculateChange(10_000, 7000)).toEqual({
      status: 'missing',
      missingCents: 3000,
      changeCents: 0
    });
  });

  it('rechaza montos inválidos', () => {
    expect(() => calculateChange(-1, 100)).toThrow();
    expect(() => calculateChange(100, 10.5)).toThrow();
  });
});

describe('breakdownChange', () => {
  it('sugiere denominaciones de mayor a menor', () => {
    const { parts, remainderCents } = breakdownChange(3500);
    expect(parts).toEqual([
      { valueCents: 2000, count: 1 },
      { valueCents: 1000, count: 1 },
      { valueCents: 500, count: 1 }
    ]);
    expect(remainderCents).toBe(0);
  });

  it('usa la menor cantidad de piezas', () => {
    const { parts } = breakdownChange(6000);
    expect(parts).toEqual([{ valueCents: 5000, count: 1 }, { valueCents: 1000, count: 1 }]);
  });

  it('devuelve vacío para cambio cero', () => {
    expect(breakdownChange(0)).toEqual({ parts: [], remainderCents: 0 });
  });

  it('informa el sobrante que no se puede cubrir', () => {
    const { parts, remainderCents } = breakdownChange(125);
    expect(parts).toEqual([{ valueCents: 100, count: 1 }, { valueCents: 20, count: 1 }]);
    expect(remainderCents).toBe(5);
  });
});
