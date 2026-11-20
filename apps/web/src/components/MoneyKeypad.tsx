import { appendDigit, appendDoubleZero, removeLastDigit } from '../lib/money';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;
type Key = (typeof KEYS)[number];

type MoneyKeypadProps = {
  valueCents: number;
  onChange: (cents: number) => void;
};

function feedback() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
  }
}

export function MoneyKeypad({ valueCents, onChange }: MoneyKeypadProps) {
  const press = (key: Key) => {
    feedback();

    if (key === 'del') {
      onChange(removeLastDigit(valueCents));
      return;
    }
    if (key === '00') {
      onChange(appendDoubleZero(valueCents));
      return;
    }
    onChange(appendDigit(valueCents, Number(key)));
  };

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          aria-label={key === 'del' ? 'Borrar último dígito' : undefined}
          className={[
            'h-14 rounded-2xl text-2xl font-semibold transition-colors select-none',
            'active:scale-[0.98] active:bg-ink-200',
            key === 'del'
              ? 'bg-rose-100 text-rose-800 shadow-sm active:bg-rose-200'
              : 'bg-white text-ink-900 shadow-sm'
          ].join(' ')}
        >
          {key === 'del' ? '⌫' : key}
        </button>
      ))}
    </div>
  );
}
