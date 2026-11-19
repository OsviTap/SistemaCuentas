import { useEffect, useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { CashMovementMedium, ExpenseKind } from '../../db/db';
import { CashError, recordCashExpense } from '../../domain/cash';
import { formatBs } from '../../lib/money';

type CashExpenseSheetProps = {
  onCancel: () => void;
  onSaved: () => void;
};

export function CashExpenseSheet({ onCancel, onSaved }: CashExpenseSheetProps) {
  const [kind, setKind] = useState<ExpenseKind>('expense');
  const [medium, setMedium] = useState<CashMovementMedium>('cash');
  const [amountCents, setAmountCents] = useState(0);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const canSave = amountCents > 0 && description.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      await recordCashExpense({
        kind,
        medium,
        amountCents,
        description
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof CashError || caught instanceof Error
          ? caught.message
          : 'No se pudo registrar el egreso.'
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar gasto o retiro"
    >
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <h2 className="text-lg font-bold text-ink-900">Gasto o retiro</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cancelar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
            <button
              type="button"
              onClick={() => setKind('expense')}
              aria-pressed={kind === 'expense'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                kind === 'expense' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Gasto del negocio
            </button>
            <button
              type="button"
              onClick={() => setKind('owner_withdrawal')}
              aria-pressed={kind === 'owner_withdrawal'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                kind === 'owner_withdrawal' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Retiro de dueña
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
            <button
              type="button"
              onClick={() => setMedium('cash')}
              aria-pressed={medium === 'cash'}
              className={[
                'h-10 rounded-xl text-sm font-semibold transition-colors',
                medium === 'cash' ? 'bg-brand-600 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMedium('qr')}
              aria-pressed={medium === 'qr'}
              className={[
                'h-10 rounded-xl text-sm font-semibold transition-colors',
                medium === 'qr' ? 'bg-brand-600 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              QR / Transferencia
            </button>
          </div>

          <div className="mt-3">
            <label htmlFor="cash-expense-desc" className="block text-xs font-semibold text-ink-600 uppercase">
              Descripción
            </label>
            <input
              id="cash-expense-desc"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={kind === 'owner_withdrawal' ? 'Ej. Retiro personal' : 'Ej. Bolsas, agua, pasaje'}
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div className="mt-3 rounded-2xl bg-ink-900 px-4 py-3 text-white">
            <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">Monto</p>
            <p className="tabular mt-1 text-3xl font-black">{formatBs(amountCents)}</p>
          </div>

          <div className="mt-3">
            <MoneyKeypad valueCents={amountCents} onChange={setAmountCents} />
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-ink-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className={[
              'h-14 w-full rounded-2xl text-base font-bold transition-colors',
              canSave
                ? 'bg-brand-600 text-white active:bg-brand-700'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            {saving ? 'Guardando…' : 'Registrar salida'}
          </button>
        </footer>
      </div>
    </div>
  );
}

