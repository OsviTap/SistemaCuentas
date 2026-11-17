import { describe, expect, it } from 'vitest';
import {
  formatCalculatorDisplay,
  formatCalculatorNumber,
  initialCalculatorState,
  reduceCalculator,
  type CalculatorAction,
  type CalculatorState
} from './calculator';

function press(actions: CalculatorAction[], start: CalculatorState = initialCalculatorState) {
  return actions.reduce(reduceCalculator, start);
}

function digit(value: string): CalculatorAction {
  return { type: 'digit', digit: value };
}

describe('formatCalculatorNumber', () => {
  it('quita ceros y ruido de coma flotante', () => {
    expect(formatCalculatorNumber(5)).toBe('5');
    expect(formatCalculatorNumber(12.5)).toBe('12.5');
    expect(formatCalculatorNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatCalculatorNumber(-0)).toBe('0');
    expect(formatCalculatorNumber(1 / 3)).toBe('0.333333333333');
  });

  it('marca los resultados no finitos', () => {
    expect(formatCalculatorNumber(Number.NaN)).toBe('Error');
    expect(formatCalculatorNumber(Infinity)).toBe('Error');
  });
});

describe('formatCalculatorDisplay', () => {
  it('usa punto de miles y coma decimal', () => {
    expect(formatCalculatorDisplay('1234.5')).toBe('1.234,5');
    expect(formatCalculatorDisplay('-1000')).toBe('-1.000');
    expect(formatCalculatorDisplay('0.')).toBe('0,');
  });
});

describe('calculadora', () => {
  it('compone números y decimales', () => {
    const state = press([digit('1'), digit('2'), { type: 'decimal' }, digit('5')]);
    expect(state.display).toBe('12.5');
  });

  it('suma al confirmar', () => {
    const state = press([
      digit('2'),
      { type: 'operator', operator: '+' },
      digit('3'),
      { type: 'equals' }
    ]);
    expect(state.display).toBe('5');
    expect(state.expression).toBe('2 + 3 =');
  });

  it('evalúa en orden de tecleo, sin precedencia', () => {
    const state = press([
      digit('2'),
      { type: 'operator', operator: '+' },
      digit('3'),
      { type: 'operator', operator: '×' },
      digit('4'),
      { type: 'equals' }
    ]);
    expect(state.display).toBe('20');
    expect(state.expression).toBe('5 × 4 =');
  });

  it('maneja decimales sin ruido binario', () => {
    const state = press([
      digit('0'),
      { type: 'decimal' },
      digit('1'),
      { type: 'operator', operator: '+' },
      digit('0'),
      { type: 'decimal' },
      digit('2'),
      { type: 'equals' }
    ]);
    expect(state.display).toBe('0.3');
  });

  it('cambia el operador si se presiona dos veces', () => {
    const state = press([
      digit('5'),
      { type: 'operator', operator: '+' },
      { type: 'operator', operator: '×' }
    ]);
    expect(state.operator).toBe('×');
    expect(state.expression).toBe('5 ×');
  });

  it('marca error al dividir entre cero', () => {
    const state = press([
      digit('5'),
      { type: 'operator', operator: '÷' },
      digit('0'),
      { type: 'equals' }
    ]);
    expect(state.error).toBe(true);
    expect(state.display).toBe('Error');
  });

  it('se recupera del error al teclear un dígito', () => {
    const error = press([
      digit('5'),
      { type: 'operator', operator: '÷' },
      digit('0'),
      { type: 'equals' }
    ]);
    const recovered = reduceCalculator(error, digit('7'));
    expect(recovered.display).toBe('7');
    expect(recovered.error).toBe(false);
  });

  it('borra el último dígito', () => {
    const state = press([digit('1'), digit('2'), digit('3'), { type: 'backspace' }]);
    expect(state.display).toBe('12');
  });

  it('cambia el signo', () => {
    const state = press([digit('5'), { type: 'toggleSign' }]);
    expect(state.display).toBe('-5');
  });

  it('calcula porcentajes', () => {
    const state = press([digit('5'), digit('0'), { type: 'percent' }]);
    expect(state.display).toBe('0.5');
  });

  it('empieza un cálculo nuevo después de igual', () => {
    const state = press([
      digit('2'),
      { type: 'operator', operator: '+' },
      digit('3'),
      { type: 'equals' },
      digit('7')
    ]);
    expect(state.display).toBe('7');
    expect(state.expression).toBe('');
    expect(state.accumulator).toBeNull();
  });

  it('recupera un valor del historial', () => {
    const state = press([{ type: 'recall', value: '37.5' }]);
    expect(state.display).toBe('37.5');
    expect(state.expression).toBe('');
  });
});
