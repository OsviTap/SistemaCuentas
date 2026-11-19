import { useEffect, useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import { ServiceError, createService } from '../../domain/services';
import { formatBs } from '../../lib/money';

type ServiceFormSheetProps = {
  onCancel: () => void;
  onSaved: () => void;
};

type AmountTarget = 'commission' | 'fixed' | null;

export function ServiceFormSheet({ onCancel, onSaved }: ServiceFormSheetProps) {
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [commissionFixedCents, setCommissionFixedCents] = useState(200);
  const [commissionPercent, setCommissionPercent] = useState('');
  const [hasFixedAmount, setHasFixedAmount] = useState(false);
  const [fixedAmountCents, setFixedAmountCents] = useState(0);
  const [requiresSupplyNumber, setRequiresSupplyNumber] = useState(true);
  const [editingAmount, setEditingAmount] = useState<AmountTarget>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const canSave =
    name.trim().length > 0 &&
    providerName.trim().length > 0 &&
    (!hasFixedAmount || fixedAmountCents > 0) &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const pct = commissionPercent.trim() ? Number(commissionPercent.replace(',', '.')) : 0;
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new ServiceError('El porcentaje debe estar entre 0 y 100.');
      }
      const commissionBps = Math.round(pct * 100);

      await createService({
        name,
        providerName,
        commissionFixedCents,
        commissionBps,
        fixedAmountCents: hasFixedAmount ? fixedAmountCents : undefined,
        requiresSupplyNumber
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ServiceError || caught instanceof Error
          ? caught.message
          : 'No se pudo guardar el servicio.'
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo servicio"
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100"
      >
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <h2 className="text-lg font-bold text-ink-900">Nuevo servicio</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cancelar
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="svc-name" className="block text-xs font-semibold text-ink-600 uppercase">
              Nombre del servicio *
            </label>
            <input
              id="svc-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Luz eléctrica, Agua, Recarga"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="svc-provider" className="block text-xs font-semibold text-ink-600 uppercase">
              Empresa prestataria *
            </label>
            <input
              id="svc-provider"
              type="text"
              required
              value={providerName}
              onChange={(event) => setProviderName(event.target.value)}
              placeholder="Ej. DELAPAZ, EPSAS, Entel"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setEditingAmount(editingAmount === 'commission' ? null : 'commission')
              }
              className={[
                'rounded-2xl bg-white p-3 text-left ring-1 transition-colors',
                editingAmount === 'commission' ? 'ring-2 ring-brand-600' : 'ring-ink-200'
              ].join(' ')}
            >
              <span className="block text-[11px] font-semibold text-ink-500 uppercase">
                Comisión fija
              </span>
              <span className="tabular mt-1 block text-lg font-bold text-ink-900">
                {formatBs(commissionFixedCents)}
              </span>
            </button>

            <div className="rounded-2xl bg-white p-3 ring-1 ring-ink-200">
              <label htmlFor="svc-pct" className="block text-[11px] font-semibold text-ink-500 uppercase">
                Comisión %
              </label>
              <input
                id="svc-pct"
                type="text"
                inputMode="decimal"
                value={commissionPercent}
                onChange={(event) => setCommissionPercent(event.target.value)}
                placeholder="0"
                className="tabular mt-1 w-full text-lg font-bold text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
          </div>

          {editingAmount === 'commission' ? (
            <MoneyKeypad
              valueCents={commissionFixedCents}
              onChange={setCommissionFixedCents}
            />
          ) : null}

          <label className="flex h-12 items-center justify-between rounded-2xl bg-white px-4">
            <span className="text-sm font-semibold text-ink-800">
              Requiere número de suministro / cuenta
            </span>
            <input
              type="checkbox"
              checked={requiresSupplyNumber}
              onChange={(event) => setRequiresSupplyNumber(event.target.checked)}
              className="h-5 w-5 accent-brand-600"
            />
          </label>

          <label className="flex h-12 items-center justify-between rounded-2xl bg-white px-4">
            <span className="text-sm font-semibold text-ink-800">
              Tiene monto fijo (ej. recarga)
            </span>
            <input
              type="checkbox"
              checked={hasFixedAmount}
              onChange={(event) => {
                setHasFixedAmount(event.target.checked);
                if (event.target.checked) setEditingAmount('fixed');
                else if (editingAmount === 'fixed') setEditingAmount(null);
              }}
              className="h-5 w-5 accent-brand-600"
            />
          </label>

          {hasFixedAmount ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setEditingAmount(editingAmount === 'fixed' ? null : 'fixed')}
                className="flex w-full items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-white"
              >
                <span className="text-xs font-semibold text-ink-300 uppercase">
                  Monto fijo del servicio
                </span>
                <span className="tabular text-xl font-black">
                  {formatBs(fixedAmountCents)}
                </span>
              </button>
              {editingAmount === 'fixed' ? (
                <MoneyKeypad valueCents={fixedAmountCents} onChange={setFixedAmountCents} />
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-ink-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="submit"
            disabled={!canSave}
            className={[
              'h-14 w-full rounded-2xl text-base font-bold transition-colors',
              canSave
                ? 'bg-brand-600 text-white active:bg-brand-700'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            {saving ? 'Guardando…' : 'Guardar servicio'}
          </button>
        </footer>
      </form>
    </div>
  );
}
