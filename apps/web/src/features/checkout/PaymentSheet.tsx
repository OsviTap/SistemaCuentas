import { useEffect, useState } from 'react';
import { formatBs } from '../../lib/money';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import { ChangeCalculator } from './ChangeCalculator';
import {
  buildPayments,
  MIN_QR_REFERENCE_LENGTH,
  type PaymentDraft,
  type PaymentMethod,
  type SalePaymentInput
} from './payments';

type PaymentSheetProps = {
  totalCents: number;
  onCancel: () => void;
  onConfirm: (result: { payments: SalePaymentInput[]; changeCents: number }) => void;
};

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Efectivo' },
  { id: 'qr', label: 'QR' },
  { id: 'mixed', label: 'Mixto' }
];

type MixedField = 'cash' | 'qr';

export function PaymentSheet({ totalCents, onCancel, onConfirm }: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [receivedCents, setReceivedCents] = useState(0);
  const [cashCents, setCashCents] = useState(0);
  const [qrCents, setQrCents] = useState(0);
  const [activeField, setActiveField] = useState<MixedField>('cash');
  const [qrReference, setQrReference] = useState('');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const draft: PaymentDraft = {
    method,
    cashReceivedCents: receivedCents,
    cashCents,
    qrCents,
    qrReference
  };

  const validation = buildPayments(draft, totalCents);
  const missingMixedCents = Math.max(totalCents - cashCents - qrCents, 0);
  const excessMixedCents = Math.max(cashCents + qrCents - totalCents, 0);

  const setActiveAmount = (cents: number) => {
    if (activeField === 'cash') {
      setCashCents(cents);
      return;
    }
    setQrCents(cents);
  };

  const activeAmount = activeField === 'cash' ? cashCents : qrCents;
  const otherAmount = activeField === 'cash' ? qrCents : cashCents;
  const remainderForActive = Math.max(totalCents - otherAmount, 0);

  const handleConfirm = () => {
    if (!validation.ok) return;
    onConfirm({ payments: validation.payments, changeCents: validation.changeCents });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-100">
      <header className="pt-safe shrink-0 border-b border-ink-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-xl text-ink-700 active:bg-ink-200"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Cobro</p>
            <p className="tabular truncate text-2xl font-bold text-ink-900">
              {formatBs(totalCents)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 px-4 pb-3">
          {METHODS.map((item) => {
            const active = method === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                aria-pressed={active}
                className={[
                  'h-11 rounded-xl text-sm font-semibold transition-colors',
                  active
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-100 text-ink-600 active:bg-ink-200'
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {method === 'cash' ? (
          <ChangeCalculator
            totalCents={totalCents}
            receivedCents={receivedCents}
            onChange={setReceivedCents}
          />
        ) : null}

        {method === 'qr' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl bg-ink-900 px-5 py-5 text-white">
              <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
                Se cobra por QR
              </p>
              <p className="tabular mt-1 text-4xl font-bold">{formatBs(totalCents)}</p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-700">Referencia del QR</span>
              <input
                value={qrReference}
                onChange={(event) => setQrReference(event.target.value)}
                placeholder="Últimos 4 dígitos o número completo"
                autoCapitalize="characters"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={40}
                className="w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-lg font-semibold tracking-wide uppercase outline-none focus:border-brand-500"
              />
              <span className="text-xs text-ink-500">
                Mínimo {MIN_QR_REFERENCE_LENGTH} caracteres. Se avisará si se repite.
              </span>
            </label>
          </div>
        ) : null}

        {method === 'mixed' ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'qr'] as const).map((field) => {
                const active = activeField === field;
                const amount = field === 'cash' ? cashCents : qrCents;
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setActiveField(field)}
                    aria-pressed={active}
                    className={[
                      'rounded-2xl px-4 py-3 text-left transition-colors',
                      active
                        ? 'bg-white ring-2 ring-brand-500'
                        : 'bg-white/70 ring-1 ring-ink-200'
                    ].join(' ')}
                  >
                    <span className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                      {field === 'cash' ? 'Efectivo' : 'QR'}
                    </span>
                    <span className="tabular mt-1 block text-2xl font-bold text-ink-900">
                      {formatBs(amount)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-ink-200/60 px-4 py-2 text-sm">
              <span className="font-medium text-ink-600">
                {missingMixedCents > 0
                  ? `Falta ${formatBs(missingMixedCents)}`
                  : excessMixedCents > 0
                    ? `Sobra ${formatBs(excessMixedCents)}`
                    : 'Completo'}
              </span>
              <button
                type="button"
                onClick={() => setActiveAmount(remainderForActive)}
                className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-ink-700 active:bg-ink-100"
              >
                Usar resto
              </button>
            </div>

            <MoneyKeypad valueCents={activeAmount} onChange={setActiveAmount} />

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-ink-700">Referencia del QR</span>
              <input
                value={qrReference}
                onChange={(event) => setQrReference(event.target.value)}
                placeholder="Últimos 4 dígitos o número completo"
                autoCapitalize="characters"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={40}
                className="w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-lg font-semibold tracking-wide uppercase outline-none focus:border-brand-500"
              />
            </label>
          </div>
        ) : null}

        {method !== 'cash' && !validation.ok ? (
          <p className="mt-3 text-sm font-medium text-amber-700">{validation.error}</p>
        ) : null}
      </div>

      <footer className="pb-safe shrink-0 border-t border-ink-200 bg-white px-4 pt-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!validation.ok}
          className={[
            'h-14 w-full rounded-2xl text-lg font-bold transition-colors',
            validation.ok
              ? 'bg-brand-600 text-white active:bg-brand-700'
              : 'bg-ink-200 text-ink-400'
          ].join(' ')}
        >
          Cobrar {formatBs(totalCents)}
        </button>
      </footer>
    </div>
  );
}
