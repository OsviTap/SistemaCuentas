import { breakdownChange, calculateChange, formatBs, MAX_AMOUNT_CENTS } from '../../lib/money';
import { MoneyKeypad } from '../../components/MoneyKeypad';

const PRESET_BILLS = [2000, 5000, 10_000, 20_000];

type ChangeCalculatorProps = {
  totalCents: number;
  receivedCents: number;
  onChange: (cents: number) => void;
};

function describeBreakdown(changeCents: number): string | null {
  if (changeCents <= 0) return null;

  const { parts, remainderCents } = breakdownChange(changeCents);

  if (parts.length === 0) return null;

  const text = parts
    .map((part) => `${part.count} × ${formatBs(part.valueCents)}`)
    .join(' · ');

  return remainderCents > 0 ? `${text} (+ ${formatBs(remainderCents)} sin moneda)` : text;
}

export function ChangeCalculator({
  totalCents,
  receivedCents,
  onChange
}: ChangeCalculatorProps) {
  const result = calculateChange(totalCents, receivedCents);
  const suggestion = describeBreakdown(result.changeCents);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-3xl bg-ink-900 px-5 py-4 text-white">
        <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">Recibido</p>
        <p className="tabular mt-1 text-4xl font-bold">{formatBs(receivedCents)}</p>
      </div>

      <div
        className={[
          'rounded-3xl px-5 py-4',
          result.status === 'missing'
            ? 'bg-amber-100 text-amber-900'
            : 'bg-brand-600 text-white'
        ].join(' ')}
        aria-live="polite"
      >
        <p className="text-xs font-medium tracking-wide uppercase opacity-80">
          {result.status === 'missing' ? 'Falta' : 'Cambio'}
        </p>
        <p className="tabular mt-1 text-5xl leading-none font-black">
          {formatBs(
            result.status === 'missing' ? result.missingCents : result.changeCents
          )}
        </p>
        {suggestion ? (
          <p className="mt-2 text-sm font-medium opacity-90">Sugerencia: {suggestion}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESET_BILLS.map((bill) => (
          <button
            key={bill}
            type="button"
            onClick={() => onChange(Math.min(receivedCents + bill, MAX_AMOUNT_CENTS))}
            className="h-12 rounded-xl bg-white text-sm font-semibold text-ink-700 shadow-sm active:bg-ink-200"
          >
            +{formatBs(bill)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange(totalCents)}
        className="h-12 rounded-xl bg-ink-200 text-base font-semibold text-ink-800 active:bg-ink-300"
      >
        Exacto
      </button>

      <MoneyKeypad valueCents={receivedCents} onChange={onChange} />
    </div>
  );
}
