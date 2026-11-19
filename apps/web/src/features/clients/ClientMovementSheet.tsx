import { useEffect, useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { CashMovementMedium, Client } from '../../db/db';
import { ClientError, recordClientCashOperation } from '../../domain/clients';
import { MIN_QR_REFERENCE_LENGTH } from '../checkout/payments';
import { formatBs } from '../../lib/money';

type ClientMovementSheetProps = {
  client: Client;
  type: 'deposit' | 'withdrawal';
  onCancel: () => void;
  onSaved: () => void;
};

export function ClientMovementSheet({
  client,
  type,
  onCancel,
  onSaved
}: ClientMovementSheetProps) {
  const [medium, setMedium] = useState<CashMovementMedium>('cash');
  const [amountCents, setAmountCents] = useState(0);
  const [qrReference, setQrReference] = useState('');
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

  const isDeposit = type === 'deposit';
  const qrValid =
    medium === 'cash' || qrReference.trim().length >= MIN_QR_REFERENCE_LENGTH;
  const canSave = amountCents > 0 && qrValid && !saving;

  const projectedBalance = isDeposit
    ? client.balanceCents + amountCents
    : client.balanceCents - amountCents;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      await recordClientCashOperation({
        clientId: client.id,
        type,
        medium,
        amountCents,
        qrReference: medium === 'qr' ? qrReference : undefined,
        description
      });
      onSaved();
    } catch (caught) {
      setError(
        caught instanceof ClientError || caught instanceof Error
          ? caught.message
          : 'No se pudo registrar el movimiento.'
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label={isDeposit ? 'Depósito de cliente' : 'Retiro de cliente'}
    >
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">
              {isDeposit ? 'Depósito' : 'Retiro'} · {client.name}
            </h2>
            <p className="text-xs text-ink-500">
              Saldo actual: <span className="tabular font-semibold">{formatBs(client.balanceCents)}</span>
            </p>
          </div>
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
              onClick={() => setMedium('cash')}
              aria-pressed={medium === 'cash'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                medium === 'cash' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMedium('qr')}
              aria-pressed={medium === 'qr'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                medium === 'qr' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              QR
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-ink-900 px-4 py-3 text-white">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
                {isDeposit ? 'Monto a depositar' : 'Monto a retirar'}
              </p>
              <p className="text-xs text-ink-300">
                Nuevo saldo:{' '}
                <span className="tabular font-bold text-white">
                  {formatBs(projectedBalance)}
                </span>
              </p>
            </div>
            <p className="tabular mt-1 text-3xl font-black">{formatBs(amountCents)}</p>
          </div>

          <div className="mt-3">
            <MoneyKeypad valueCents={amountCents} onChange={setAmountCents} />
          </div>

          {medium === 'qr' ? (
            <div className="mt-3">
              <label htmlFor="client-qr-ref" className="block text-xs font-semibold text-ink-600 uppercase">
                Referencia QR (mín. {MIN_QR_REFERENCE_LENGTH} caracteres)
              </label>
              <input
                id="client-qr-ref"
                type="text"
                value={qrReference}
                onChange={(event) => setQrReference(event.target.value)}
                placeholder="Ej. 982341"
                className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
              />
            </div>
          ) : null}

          <div className="mt-3">
            <label htmlFor="client-mov-desc" className="block text-xs font-semibold text-ink-600 uppercase">
              Nota (opcional)
            </label>
            <input
              id="client-mov-desc"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={isDeposit ? 'Ej. Adelanto de la semana' : 'Ej. Retiro en efectivo'}
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
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
                ? isDeposit
                  ? 'bg-brand-600 text-white active:bg-brand-700'
                  : 'bg-ink-900 text-white active:bg-ink-800'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            {saving
              ? 'Guardando…'
              : isDeposit
                ? 'Confirmar depósito'
                : 'Confirmar retiro'}
          </button>
        </footer>
      </div>
    </div>
  );
}
