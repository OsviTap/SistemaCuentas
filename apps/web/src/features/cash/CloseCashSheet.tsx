import { useEffect, useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { CashSession } from '../../db/db';
import {
  CashError,
  closeCashSession,
  denominationType,
  sumDenominations
} from '../../domain/cash';
import { BOB_DENOMINATIONS, formatBs } from '../../lib/money';

type CloseCashSheetProps = {
  session: CashSession;
  expectedCashCents: number;
  expectedQrCents: number;
  onCancel: () => void;
  onClosed: (closedSession: CashSession) => void;
};

type CountMode = 'denominations' | 'direct';
type DirectField = 'cash' | 'qr';

function DifferenceBadge({ diffCents }: { diffCents: number }) {
  if (diffCents === 0) {
    return (
      <span className="rounded-lg bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-800">
        Cuadrado
      </span>
    );
  }
  if (diffCents > 0) {
    return (
      <span className="tabular rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
        Sobrante +{formatBs(diffCents)}
      </span>
    );
  }
  return (
    <span className="tabular rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
      Faltante {formatBs(diffCents)}
    </span>
  );
}

export function CloseCashSheet({
  session,
  expectedCashCents,
  expectedQrCents,
  onCancel,
  onClosed
}: CloseCashSheetProps) {
  const [mode, setMode] = useState<CountMode>('denominations');
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [directCashCents, setDirectCashCents] = useState(expectedCashCents);
  const [countedQrCents, setCountedQrCents] = useState(expectedQrCents);
  const [editingField, setEditingField] = useState<DirectField | null>(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const countedCashCents =
    mode === 'denominations' ? sumDenominations(counts) : directCashCents;
  const diffCashCents = countedCashCents - expectedCashCents;
  const diffQrCents = countedQrCents - expectedQrCents;

  const updateCount = (valueCents: number, delta: number) => {
    setCounts((prev) => {
      const next = Math.max(0, (prev[valueCents] ?? 0) + delta);
      return { ...prev, [valueCents]: next };
    });
  };

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const closed = await closeCashSession({
        sessionId: session.id,
        countedCashCents,
        countedQrCents,
        denominationCounts: mode === 'denominations' ? counts : undefined,
        closingNotes
      });
      onClosed(closed);
    } catch (caught) {
      setError(
        caught instanceof CashError || caught instanceof Error
          ? caught.message
          : 'No se pudo cerrar la caja.'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Arqueo y cierre de caja"
    >
      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Arqueo y cierre Z</h2>
            <p className="text-xs text-ink-500">Sesión {session.number}</p>
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
          {/* Comparación en vivo */}
          <div className="rounded-3xl bg-ink-900 p-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-ink-300 uppercase">Efectivo contado</p>
                <p className="tabular text-3xl font-black">{formatBs(countedCashCents)}</p>
              </div>
              <DifferenceBadge diffCents={diffCashCents} />
            </div>
            <p className="mt-1 text-xs text-ink-300">
              Esperado en caja: <span className="tabular font-semibold">{formatBs(expectedCashCents)}</span>
            </p>

            <div className="mt-3 border-t border-ink-700 pt-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-ink-300 uppercase">QR informado</p>
                <p className="tabular text-lg font-bold">{formatBs(countedQrCents)}</p>
                <p className="text-xs text-ink-400">
                  Esperado QR: <span className="tabular">{formatBs(expectedQrCents)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <DifferenceBadge diffCents={diffQrCents} />
                <button
                  type="button"
                  onClick={() =>
                    setEditingField(editingField === 'qr' ? null : 'qr')
                  }
                  className="mt-1 rounded-lg bg-ink-800 px-3 py-1.5 text-xs font-semibold text-white active:bg-ink-700"
                >
                  {editingField === 'qr' ? 'Listo QR' : 'Editar QR'}
                </button>
              </div>
            </div>
          </div>

          {editingField === 'qr' ? (
            <div className="mt-3 rounded-2xl bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-600 uppercase">
                  Monto recibido por QR
                </p>
                <button
                  type="button"
                  onClick={() => setCountedQrCents(expectedQrCents)}
                  className="text-xs font-semibold text-brand-700"
                >
                  Usar esperado
                </button>
              </div>
              <MoneyKeypad valueCents={countedQrCents} onChange={setCountedQrCents} />
            </div>
          ) : null}

          {/* Modo de conteo de efectivo */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setMode('denominations');
                if (editingField === 'cash') setEditingField(null);
              }}
              aria-pressed={mode === 'denominations'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                mode === 'denominations' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Por billetes y monedas
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('direct');
                setEditingField('cash');
              }}
              aria-pressed={mode === 'direct'}
              className={[
                'h-11 rounded-xl text-sm font-semibold transition-colors',
                mode === 'direct' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Monto directo
            </button>
          </div>

          {mode === 'denominations' ? (
            <ul className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
              {BOB_DENOMINATIONS.map((valueCents) => {
                const count = counts[valueCents] ?? 0;
                const subtotal = valueCents * count;
                const kindLabel = denominationType(valueCents) === 'bill' ? 'Billete' : 'Moneda';

                return (
                  <li key={valueCents} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="tabular text-sm font-bold text-ink-900">
                        {formatBs(valueCents)}
                      </p>
                      <p className="text-xs text-ink-500">
                        {kindLabel}
                        {count > 0 ? ` · ${formatBs(subtotal)}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateCount(valueCents, -1)}
                        disabled={count === 0}
                        aria-label={`Quitar ${formatBs(valueCents)}`}
                        className={[
                          'flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold',
                          count === 0
                            ? 'bg-ink-100 text-ink-300'
                            : 'bg-ink-100 text-ink-800 active:bg-ink-200'
                        ].join(' ')}
                      >
                        −
                      </button>
                      <span className="tabular w-8 text-center text-base font-bold text-ink-900">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCount(valueCents, 1)}
                        aria-label={`Agregar ${formatBs(valueCents)}`}
                        className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-800 active:bg-brand-200"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-600 uppercase">
                  Efectivo contado total
                </p>
                <button
                  type="button"
                  onClick={() => setDirectCashCents(expectedCashCents)}
                  className="text-xs font-semibold text-brand-700"
                >
                  Usar esperado
                </button>
              </div>
              <MoneyKeypad valueCents={directCashCents} onChange={setDirectCashCents} />
            </div>
          )}

          {/* Nota de cierre */}
          <div className="mt-4">
            <label htmlFor="closing-notes" className="block text-xs font-semibold text-ink-600 uppercase">
              Nota de cierre (opcional)
            </label>
            <input
              id="closing-notes"
              type="text"
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              placeholder={
                diffCashCents !== 0 || diffQrCents !== 0
                  ? 'Explica el motivo de la diferencia…'
                  : 'Observaciones del turno…'
              }
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
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className={[
              'h-14 w-full rounded-2xl text-base font-bold transition-colors',
              submitting
                ? 'bg-ink-200 text-ink-400'
                : 'bg-ink-900 text-white active:bg-ink-800'
            ].join(' ')}
          >
            {submitting ? 'Cerrando caja…' : 'Confirmar cierre Z'}
          </button>
        </footer>
      </div>
    </div>
  );
}

