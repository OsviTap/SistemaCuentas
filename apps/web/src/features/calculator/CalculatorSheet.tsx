import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatDateTime } from '../../lib/dates';
import {
  formatCalculatorDisplay,
  initialCalculatorState,
  reduceCalculator,
  type CalculatorAction,
  type CalculatorState
} from './calculator';
import { addCalculatorEntry, clearCalculatorEntries, listCalculatorEntries } from './history';

type CalculatorSheetProps = {
  onClose: () => void;
};

type KeyVariant = 'number' | 'muted' | 'operator' | 'equals';

type KeyDefinition = {
  label: string;
  action: CalculatorAction;
  variant?: KeyVariant;
  span?: 2;
};

const KEYS: KeyDefinition[][] = [
  [
    { label: 'AC', action: { type: 'clear' }, variant: 'muted' },
    { label: '±', action: { type: 'toggleSign' }, variant: 'muted' },
    { label: '%', action: { type: 'percent' }, variant: 'muted' },
    { label: '÷', action: { type: 'operator', operator: '÷' }, variant: 'operator' }
  ],
  [
    { label: '7', action: { type: 'digit', digit: '7' } },
    { label: '8', action: { type: 'digit', digit: '8' } },
    { label: '9', action: { type: 'digit', digit: '9' } },
    { label: '×', action: { type: 'operator', operator: '×' }, variant: 'operator' }
  ],
  [
    { label: '4', action: { type: 'digit', digit: '4' } },
    { label: '5', action: { type: 'digit', digit: '5' } },
    { label: '6', action: { type: 'digit', digit: '6' } },
    { label: '−', action: { type: 'operator', operator: '-' }, variant: 'operator' }
  ],
  [
    { label: '1', action: { type: 'digit', digit: '1' } },
    { label: '2', action: { type: 'digit', digit: '2' } },
    { label: '3', action: { type: 'digit', digit: '3' } },
    { label: '+', action: { type: 'operator', operator: '+' }, variant: 'operator' }
  ],
  [
    { label: '0', action: { type: 'digit', digit: '0' }, span: 2 },
    { label: ',', action: { type: 'decimal' } },
    { label: '=', action: { type: 'equals' }, variant: 'equals' }
  ]
];

function keyClass(variant: KeyVariant = 'number'): string {
  const base =
    'h-14 rounded-2xl text-2xl font-semibold transition-colors select-none active:scale-[0.98]';

  switch (variant) {
    case 'muted':
      return `${base} bg-ink-200 text-ink-700 active:bg-ink-300`;
    case 'operator':
      return `${base} bg-brand-100 text-brand-800 active:bg-brand-200`;
    case 'equals':
      return `${base} bg-brand-600 text-white active:bg-brand-700`;
    default:
      return `${base} bg-white text-ink-900 shadow-sm active:bg-ink-100`;
  }
}

function feedback() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
  }
}

export function CalculatorSheet({ onClose }: CalculatorSheetProps) {
  const [state, setState] = useState<CalculatorState>(initialCalculatorState);
  const [view, setView] = useState<'keypad' | 'history'>('keypad');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const entries = useLiveQuery(() => listCalculatorEntries(), [], []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleEquals = () => {
    const previous = state;
    const next = reduceCalculator(previous, { type: 'equals' });
    setState(next);

    if (!next.error && previous.operator !== null && previous.accumulator !== null) {
      void addCalculatorEntry({
        expression: next.expression,
        result: formatCalculatorDisplay(next.display),
        value: next.display
      }).catch((error: unknown) => {
        console.error('No se pudo guardar el cálculo', error);
      });
    }
  };

  const handleKey = (action: CalculatorAction) => {
    feedback();
    if (action.type === 'equals') {
      handleEquals();
      return;
    }
    setState((current) => reduceCalculator(current, action));
  };

  const recall = (value: string) => {
    setState((current) => reduceCalculator(current, { type: 'recall', value }));
    setView('keypad');
  };

  const clearHistory = async () => {
    try {
      await clearCalculatorEntries();
      setConfirmingClear(false);
    } catch (error: unknown) {
      console.error('No se pudo borrar el historial', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-100">
      <header className="pt-safe shrink-0 border-b border-ink-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar calculadora"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xl text-ink-700 active:bg-ink-200"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Utilidad</p>
            <h2 className="text-lg font-bold text-ink-900">Calculadora</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setView((current) => (current === 'history' ? 'keypad' : 'history'));
              setConfirmingClear(false);
            }}
            className="shrink-0 rounded-xl bg-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            {view === 'history' ? 'Teclado' : `Historial${entries.length > 0 ? ` · ${entries.length}` : ''}`}
          </button>
        </div>
      </header>

      {view === 'keypad' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-end px-5 pb-6 text-right">
            <p className="truncate text-sm font-medium text-ink-500">
              {state.expression || '\u00a0'}
            </p>
            <p
              aria-live="polite"
              className={[
                'tabular mt-1 truncate text-6xl font-black',
                state.error ? 'text-rose-600' : 'text-ink-900'
              ].join(' ')}
            >
              {formatCalculatorDisplay(state.display)}
            </p>
          </div>

          <div className="pb-safe">
            <div className="px-3 pb-3">
              {KEYS.map((row, rowIndex) => (
                <div key={rowIndex} className="mb-2 grid grid-cols-4 gap-2">
                  {row.map((key) => (
                    <button
                      key={key.label}
                      type="button"
                      onClick={() => handleKey(key.action)}
                      className={[keyClass(key.variant), key.span === 2 ? 'col-span-2' : ''].join(' ')}
                    >
                      {key.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {entries.length === 0 ? (
              <div className="mt-10 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-ink-700">Todavía no hay cuentas</p>
                <p className="mt-2 text-sm text-ink-500">
                  Cada resultado que confirmes con «=» se guarda aquí.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => recall(entry.value)}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-right shadow-sm active:bg-ink-100"
                    >
                      <span className="block truncate text-xs font-medium text-ink-500">
                        {entry.expression}
                      </span>
                      <span className="tabular mt-0.5 block text-2xl font-bold text-ink-900">
                        {entry.result}
                      </span>
                      <span className="mt-1 block text-[10px] text-ink-400">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pb-safe shrink-0 border-t border-ink-200 bg-white px-4 pt-3">
            {confirmingClear ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="h-12 flex-1 rounded-xl bg-ink-100 text-sm font-semibold text-ink-700 active:bg-ink-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void clearHistory()}
                  className="h-12 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white active:bg-rose-700"
                >
                  Borrar historial
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                disabled={entries.length === 0}
                className={[
                  'h-12 w-full rounded-xl text-sm font-semibold',
                  entries.length === 0
                    ? 'bg-ink-100 text-ink-400'
                    : 'bg-ink-100 text-ink-700 active:bg-ink-200'
                ].join(' ')}
              >
                Borrar historial
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
