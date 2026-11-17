/**
 * Calculadora rápida: lógica pura, sin React y sin base de datos.
 *
 * Evalúa en el orden en que se teclea (sin precedencia de operadores), igual
 * que una calculadora de mostrador. Es una utilidad de consulta: no registra
 * dinero ni reemplaza la calculadora de cambio del cobro.
 */

export type CalculatorOperator = '+' | '-' | '×' | '÷';

export type CalculatorState = {
  /** Valor actual en formato canónico con punto decimal. */
  display: string;
  accumulator: number | null;
  operator: CalculatorOperator | null;
  waitingForOperand: boolean;
  /** Expresión legible para mostrar e historial. */
  expression: string;
  error: boolean;
};

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; operator: CalculatorOperator }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'backspace' }
  | { type: 'toggleSign' }
  | { type: 'percent' }
  | { type: 'recall'; value: string };

export const initialCalculatorState: CalculatorState = {
  display: '0',
  accumulator: null,
  operator: null,
  waitingForOperand: false,
  expression: '',
  error: false
};

/** Redondea a 12 dígitos significativos y devuelve texto canónico. */
export function formatCalculatorNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Error';

  const normalized = Object.is(value, -0) ? 0 : value;
  const rounded =
    Math.abs(normalized) >= 1e15 ? normalized : Number(normalized.toPrecision(12));
  let text = String(rounded);

  if (text.includes('e') || text.includes('E')) {
    text = rounded.toFixed(10);
  }
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }

  return text === '-0' ? '0' : text;
}

/** Lleva un valor canónico al formato visible boliviano: 1234.5 → "1.234,5". */
export function formatCalculatorDisplay(canonical: string): string {
  if (canonical === 'Error') return canonical;

  const negative = canonical.startsWith('-');
  const body = negative ? canonical.slice(1) : canonical;
  const [integer = '0', decimals] = body.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${negative ? '-' : ''}${grouped}${decimals !== undefined ? `,${decimals}` : ''}`;
}

function compute(a: number, b: number, operator: CalculatorOperator): number {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? Number.NaN : a / b;
  }
}

function errorState(expression: string): CalculatorState {
  return {
    display: 'Error',
    accumulator: null,
    operator: null,
    waitingForOperand: true,
    expression,
    error: true
  };
}

function label(value: number): string {
  return formatCalculatorDisplay(formatCalculatorNumber(value));
}

export function reduceCalculator(
  state: CalculatorState,
  action: CalculatorAction
): CalculatorState {
  switch (action.type) {
    case 'digit': {
      if (state.error) {
        return { ...initialCalculatorState, display: action.digit };
      }

      if (state.waitingForOperand) {
        const base = state.operator === null ? initialCalculatorState : state;
        return { ...base, display: action.digit, waitingForOperand: false };
      }

      if (state.display.replace(/[-.]/g, '').length >= 15) {
        return state;
      }

      if (state.display === '0') {
        return { ...state, display: action.digit };
      }
      if (state.display === '-0') {
        return { ...state, display: `-${action.digit}` };
      }

      return { ...state, display: `${state.display}${action.digit}` };
    }

    case 'decimal': {
      if (state.error) {
        return { ...initialCalculatorState, display: '0.' };
      }

      if (state.waitingForOperand) {
        const base = state.operator === null ? initialCalculatorState : state;
        return { ...base, display: '0.', waitingForOperand: false };
      }

      if (state.display.includes('.')) return state;
      return { ...state, display: `${state.display}.` };
    }

    case 'operator': {
      if (state.error) return state;

      if (state.operator && state.waitingForOperand) {
        return {
          ...state,
          operator: action.operator,
          expression: `${label(state.accumulator ?? 0)} ${action.operator}`
        };
      }

      if (state.operator && !state.waitingForOperand) {
        const left = state.accumulator ?? 0;
        const right = Number(state.display);
        const result = compute(left, right, state.operator);
        const expression = `${label(left)} ${state.operator} ${label(right)} ${action.operator}`;

        if (!Number.isFinite(result)) return errorState(expression);

        return {
          display: formatCalculatorNumber(result),
          accumulator: result,
          operator: action.operator,
          waitingForOperand: true,
          expression,
          error: false
        };
      }

      return {
        ...state,
        accumulator: Number(state.display),
        operator: action.operator,
        waitingForOperand: true,
        expression: `${label(Number(state.display))} ${action.operator}`
      };
    }

    case 'equals': {
      if (state.error) return state;

      if (state.operator === null || state.accumulator === null) {
        return {
          ...state,
          expression: `${label(Number(state.display))} =`,
          waitingForOperand: true
        };
      }

      const right = Number(state.display);
      const expression = `${label(state.accumulator)} ${state.operator} ${label(right)} =`;
      const result = compute(state.accumulator, right, state.operator);

      if (!Number.isFinite(result)) return errorState(expression);

      return {
        display: formatCalculatorNumber(result),
        accumulator: null,
        operator: null,
        waitingForOperand: true,
        expression,
        error: false
      };
    }

    case 'clear':
      return initialCalculatorState;

    case 'backspace': {
      if (state.error) return initialCalculatorState;
      if (state.waitingForOperand) return state;

      const next = state.display.slice(0, -1);
      return {
        ...state,
        display: next === '' || next === '-' ? '0' : next
      };
    }

    case 'toggleSign': {
      if (state.error) return state;

      if (state.waitingForOperand) {
        const base = state.operator === null ? initialCalculatorState : state;
        return { ...base, display: '-0', waitingForOperand: false };
      }

      if (state.display === '0') return state;

      return {
        ...state,
        display: state.display.startsWith('-')
          ? state.display.slice(1)
          : `-${state.display}`
      };
    }

    case 'percent': {
      if (state.error) return state;
      return {
        ...state,
        display: formatCalculatorNumber(Number(state.display) / 100),
        waitingForOperand: false
      };
    }

    case 'recall': {
      const value = Number(action.value);
      if (!Number.isFinite(value)) return state;
      return { ...initialCalculatorState, display: formatCalculatorNumber(value) };
    }
  }
}
