import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CashMovementMedium } from '../../db/db';
import {
  ServiceError,
  listPendingRemittancesByProvider,
  remitProviderServices
} from '../../domain/services';
import { formatBs } from '../../lib/money';

type RemittancesSheetProps = {
  onClose: () => void;
};

export function RemittancesSheet({ onClose }: RemittancesSheetProps) {
  const pending = useLiveQuery(() => listPendingRemittancesByProvider(), []);
  const [medium, setMedium] = useState<CashMovementMedium>('cash');
  const [notes, setNotes] = useState('');
  const [submittingProvider, setSubmittingProvider] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleRemit = async (providerName: string) => {
    if (submittingProvider) return;
    setSubmittingProvider(providerName);
    setError(null);
    setFeedback(null);

    try {
      const remittance = await remitProviderServices({
        providerName,
        medium,
        notes
      });
      setNotes('');
      setFeedback(
        `Remesa a ${remittance.providerName} por ${formatBs(remittance.amountCents)} registrada.`
      );
    } catch (caught) {
      setError(
        caught instanceof ServiceError || caught instanceof Error
          ? caught.message
          : 'No se pudo registrar la remesa.'
      );
    } finally {
      setSubmittingProvider(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Remesas a empresas"
    >
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Remesas pendientes</h2>
            <p className="text-xs text-ink-500">Dinero por entregar a cada empresa</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cerrar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
            <button
              type="button"
              onClick={() => setMedium('cash')}
              aria-pressed={medium === 'cash'}
              className={[
                'h-10 rounded-xl text-sm font-semibold transition-colors',
                medium === 'cash' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Pagar en Efectivo
            </button>
            <button
              type="button"
              onClick={() => setMedium('qr')}
              aria-pressed={medium === 'qr'}
              className={[
                'h-10 rounded-xl text-sm font-semibold transition-colors',
                medium === 'qr' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Pagar por QR
            </button>
          </div>

          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Nota opcional (ej. comprobante, agencia)…"
            className="mt-3 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
          />

          {feedback ? (
            <p className="mt-3 rounded-xl bg-brand-100 px-4 py-2 text-sm font-medium text-brand-900">
              {feedback}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}

          <div className="mt-4">
            {pending === undefined ? (
              <div className="h-24 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            ) : pending.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-ink-700">Sin remesas pendientes</p>
                <p className="mt-1 text-xs text-ink-500">
                  Todo lo cobrado por servicios ya fue remitido.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pending.map((row) => (
                  <li key={row.providerName} className="rounded-2xl bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-ink-900">{row.providerName}</p>
                        <p className="text-xs text-ink-500">
                          {row.itemCount} {row.itemCount === 1 ? 'cobro' : 'cobros'} ·
                          Comisión retenida: {formatBs(row.totalCommissionCents)}
                        </p>
                      </div>
                      <p className="tabular text-xl font-black text-ink-900">
                        {formatBs(row.totalServiceAmountCents)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRemit(row.providerName)}
                      disabled={submittingProvider !== null}
                      className="mt-3 h-12 w-full rounded-xl bg-ink-900 text-sm font-bold text-white active:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400"
                    >
                      {submittingProvider === row.providerName
                        ? 'Remitiendo…'
                        : `Remitir ${formatBs(row.totalServiceAmountCents)}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
