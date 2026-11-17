import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { CashMovement, CashSession } from '../../db/db';
import {
  CashError,
  getOpenCashSession,
  getSessionTotals,
  listSessionMovements,
  openCashSession
} from '../../domain/cash';
import { formatDateTime } from '../../lib/dates';
import { CASH_MOVEMENT_LABELS } from '../../lib/labels';
import { formatBs } from '../../lib/money';

function movementLabel(movement: CashMovement): string {
  return CASH_MOVEMENT_LABELS[movement.type] ?? movement.type;
}

function CajaOpen({ session }: { session: CashSession }) {
  const totals = useLiveQuery(() => getSessionTotals(session), [session.id]);
  const movements = useLiveQuery(() => listSessionMovements(session.id, 6), [session.id]);

  return (
    <div className="px-4 pb-6">
      <div className="rounded-3xl bg-ink-900 px-5 py-5 text-white">
        <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
          Efectivo esperado
        </p>
        <p className="tabular mt-1 text-4xl font-black">
          {formatBs(totals?.expectedCashCents ?? session.openingCashCents)}
        </p>
        <p className="mt-2 text-xs text-ink-300">
          Incluye {formatBs(session.openingCashCents)} de apertura y el efectivo cobrado.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">QR cobrado</p>
          <p className="tabular mt-1 text-xl font-bold text-ink-900">
            {formatBs(totals?.expectedQrCents ?? session.openingQrCents)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Ventas</p>
          <p className="tabular mt-1 text-xl font-bold text-ink-900">
            {totals?.salesCount ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
        <span className="text-ink-500">Sesión</span>
        <span className="font-semibold text-ink-900">{session.number}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm">
        <span className="text-ink-500">Abierta</span>
        <span className="font-semibold text-ink-900">{formatDateTime(session.openedAt)}</span>
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Últimos movimientos
          </h2>
          <Link to="/mas/historial" className="text-xs font-semibold text-brand-700">
            Ver todo
          </Link>
        </div>

        {movements === undefined ? (
          <div className="h-20 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
        ) : movements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-300 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
            Todavía no hay movimientos en esta caja.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    movement.amountCents >= 0
                      ? 'bg-brand-100 text-brand-800'
                      : 'bg-rose-100 text-rose-800'
                  ].join(' ')}
                >
                  {movement.amountCents >= 0 ? '+' : '−'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {movementLabel(movement)}
                  </p>
                  <p className="text-xs text-ink-500">
                    {movement.medium === 'cash' ? 'Efectivo' : 'QR'} ·{' '}
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>
                <span className="tabular text-sm font-bold text-ink-900">
                  {formatBs(movement.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to="/mas/historial"
        className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-ink-700 active:bg-ink-200"
      >
        Historial de caja
      </Link>

      <div className="mt-3 rounded-2xl border border-dashed border-ink-300 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-ink-700">Cerrar caja</p>
        <p className="mt-1 text-xs text-ink-500">
          El arqueo y cierre con conteo físico se habilitan en la siguiente fase.
        </p>
      </div>
    </div>
  );
}

export function CashPage() {
  const session = useLiveQuery(
    async () => (await getOpenCashSession()) ?? null,
    [],
    undefined
  );
  const [openingCashCents, setOpeningCashCents] = useState(0);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    setError(null);

    try {
      await openCashSession({ openingCashCents });
    } catch (caught) {
      setError(
        caught instanceof CashError || caught instanceof Error
          ? caught.message
          : 'No se pudo abrir la caja.'
      );
      setOpening(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Dinero</p>
        <h1 className="text-2xl font-bold text-ink-900">Caja</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {session === undefined ? (
          <div className="px-4">
            <div className="h-36 animate-pulse rounded-3xl bg-white/60" aria-hidden="true" />
          </div>
        ) : session === null ? (
          <div className="px-4 pb-6">
            <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">La caja está cerrada.</p>
              <p className="mt-1">Cuenta el efectivo con el que empiezas y abre la sesión.</p>
            </div>

            <div className="mt-4 rounded-3xl bg-ink-900 px-5 py-4 text-white">
              <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
                Efectivo inicial
              </p>
              <p className="tabular mt-1 text-4xl font-black">{formatBs(openingCashCents)}</p>
            </div>

            <div className="mt-3">
              <MoneyKeypad valueCents={openingCashCents} onChange={setOpeningCashCents} />
            </div>

            {error ? (
              <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
                {error}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-ink-500">
              Si empiezas sin efectivo, deja el monto en cero. El QR cobrado se suma aparte.
            </p>

            <button
              type="button"
              onClick={() => void handleOpen()}
              disabled={opening}
              className={[
                'mt-4 h-14 w-full rounded-2xl text-lg font-bold transition-colors',
                opening
                  ? 'bg-ink-200 text-ink-400'
                  : 'bg-brand-600 text-white active:bg-brand-700'
              ].join(' ')}
            >
              {opening ? 'Abriendo…' : 'Abrir caja'}
            </button>
          </div>
        ) : (
          <CajaOpen session={session} />
        )}
      </div>
    </div>
  );
}
