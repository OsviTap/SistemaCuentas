import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { CashSession, Sale, SalePayment } from '../../db/db';
import { getOpenCashSession, listClosedCashSessions } from '../../domain/cash';
import { isPinConfigured, verifyOwnerPin } from '../../domain/pin';
import { SaleError, voidSale } from '../../domain/sales';
import { CashReportSheet } from '../cash/CashReportSheet';
import { formatDateTime } from '../../lib/dates';
import {
  ACCOUNT_MOVEMENT_LABELS,
  CASH_MOVEMENT_LABELS,
  PAYMENT_METHOD_LABELS
} from '../../lib/labels';
import { formatBs } from '../../lib/money';
import {
  listRecentAccountMovements,
  listRecentCashMovements,
  listRecentSales
} from './queries';

type HistoryTab = 'sales' | 'cash' | 'accounts';

const TABS: Array<{ id: HistoryTab; label: string }> = [
  { id: 'sales', label: 'Ventas' },
  { id: 'cash', label: 'Caja' },
  { id: 'accounts', label: 'Cuentas' }
];

function paymentsSummary(payments: SalePayment[]): string {
  if (payments.length === 0) return 'Sin pago';
  return payments.map((payment) => PAYMENT_METHOD_LABELS[payment.method]).join(' + ');
}

export function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>('sales');
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidPin, setVoidPin] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  const openSession = useLiveQuery(() => getOpenCashSession(), []);
  const pinEnabled = useLiveQuery(() => isPinConfigured(), [], false);
  const sales = useLiveQuery(() => listRecentSales(), []);
  const cashMovements = useLiveQuery(() => listRecentCashMovements(), []);
  const closedSessions = useLiveQuery(() => listClosedCashSessions(), []);
  const accountMovements = useLiveQuery(() => listRecentAccountMovements(), []);

  const handleConfirmVoid = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!voidTarget || voiding) return;
    setVoiding(true);
    setVoidError(null);

    try {
      if (pinEnabled && !(await verifyOwnerPin(voidPin))) {
        throw new SaleError('El PIN de autorización es incorrecto.');
      }
      await voidSale({ saleId: voidTarget.id, reason: voidReason });
      setVoidTarget(null);
      setVoidReason('');
      setVoidPin('');
    } catch (caught) {
      setVoidError(
        caught instanceof SaleError || caught instanceof Error
          ? caught.message
          : 'No se pudo anular la venta.'
      );
    } finally {
      setVoiding(false);
    }
  };

  const loading =
    (tab === 'sales' && sales === undefined) ||
    (tab === 'cash' && (cashMovements === undefined || closedSessions === undefined)) ||
    (tab === 'accounts' && accountMovements === undefined);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Link
            to="/mas"
            aria-label="Volver a Más"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-700 active:bg-ink-200"
          >
            ←
          </Link>
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Más</p>
            <h1 className="text-2xl font-bold text-ink-900">Historial</h1>
          </div>
        </div>
      </header>

      <div className="shrink-0 px-4 pb-2">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={active}
                className={[
                  'h-10 rounded-xl text-sm font-semibold transition-colors',
                  active ? 'bg-ink-900 text-white' : 'text-ink-600 active:bg-ink-100'
                ].join(' ')}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
          </div>
        ) : tab === 'sales' ? (
          sales && sales.length > 0 ? (
            <ul className="space-y-2">
              {sales.map(({ sale, payments, itemCount }) => (
                <li key={sale.id} className="rounded-2xl bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">Venta {sale.folio}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(sale.createdAt)}</p>
                    </div>
                    <p className="tabular shrink-0 text-lg font-black text-ink-900">
                      {formatBs(sale.totalCents)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-600">
                      {paymentsSummary(payments)}
                    </span>
                    <span className="text-ink-500">
                      {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}
                    </span>
                  </div>
                  {sale.status === 'voided' ? (
                    <span className="mt-2 inline-flex rounded-lg bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">
                      Anulada{sale.voidReason ? ` · ${sale.voidReason}` : ''}
                    </span>
                  ) : openSession && sale.sessionId === openSession.id ? (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setVoidTarget(sale);
                          setVoidReason('');
                          setVoidPin('');
                          setVoidError(null);
                        }}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 active:bg-rose-100"
                      >
                        Anular
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Todavía no hay ventas"
              description="Las ventas cobradas aparecerán aquí, con su folio y su forma de pago."
            />
          )
        ) : tab === 'cash' ? (
          (closedSessions && closedSessions.length > 0) ||
          (cashMovements && cashMovements.length > 0) ? (
            <div className="space-y-4">
              {closedSessions && closedSessions.length > 0 ? (
                <section>
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    Cierres de caja
                  </h2>
                  <ul className="space-y-2">
                    {closedSessions.map((closed) => {
                      const diffCash = closed.differenceCashCents ?? 0;
                      const diffQr = closed.differenceQrCents ?? 0;
                      const hasDiff = diffCash !== 0 || diffQr !== 0;

                      return (
                        <li key={closed.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedSession(closed)}
                            className="w-full rounded-2xl bg-white px-4 py-3 text-left active:bg-ink-50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-ink-900">
                                Sesión {closed.number}
                              </p>
                              <span
                                className={[
                                  'rounded-lg px-2 py-0.5 text-xs font-bold',
                                  hasDiff
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-brand-100 text-brand-800'
                                ].join(' ')}
                              >
                                {hasDiff ? 'Con diferencia' : 'Cuadrada'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-ink-500">
                              Cerrada {closed.closedAt ? formatDateTime(closed.closedAt) : ''} · Efectivo{' '}
                              <span className="tabular font-semibold text-ink-700">
                                {formatBs(closed.countedCashCents ?? 0)}
                              </span>
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {cashMovements && cashMovements.length > 0 ? (
                <section>
                  <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                    Movimientos recientes
                  </h2>
                  <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
                    {cashMovements.map((movement) => (
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
                            {movement.description
                              ? `${CASH_MOVEMENT_LABELS[movement.type] ?? movement.type} · ${movement.description}`
                              : (CASH_MOVEMENT_LABELS[movement.type] ?? movement.type)}
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
                </section>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Todavía no hay movimientos de caja"
              description="Ventas, gastos, cierres y ajustes de efectivo o QR se verán aquí."
            />
          )
        ) : accountMovements && accountMovements.length > 0 ? (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
            {accountMovements.map(({ movement, clientName }) => (
              <li key={movement.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{clientName}</p>
                  <p className="text-xs text-ink-500">
                    {ACCOUNT_MOVEMENT_LABELS[movement.type] ?? movement.type} ·{' '}
                    {formatDateTime(movement.createdAt)}
                  </p>
                </div>
                <span
                  className={[
                    'tabular text-sm font-bold',
                    movement.amountCents >= 0 ? 'text-brand-700' : 'text-rose-700'
                  ].join(' ')}
                >
                  {formatBs(movement.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Todavía no hay movimientos de cuentas"
            description="Depósitos, retiros y pagos con saldo de clientes se verán aquí."
          />
        )}
      </div>

      {selectedSession ? (
        <CashReportSheet
          title={`Cierre Z · Sesión ${selectedSession.number}`}
          subtitle={
            selectedSession.closedAt
              ? `Cerrada ${formatDateTime(selectedSession.closedAt)}`
              : undefined
          }
          reportText={
            selectedSession.reportZText ??
            'Esta sesión no tiene texto de reporte Z guardado.'
          }
          onClose={() => setSelectedSession(null)}
          closeLabel="Cerrar"
        />
      ) : null}

      {voidTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/60"
          role="dialog"
          aria-modal="true"
          aria-label={`Anular venta ${voidTarget.folio}`}
        >
          <form
            onSubmit={(event) => void handleConfirmVoid(event)}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <h2 className="text-lg font-bold text-ink-900">
              Anular venta {voidTarget.folio}
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Total {formatBs(voidTarget.totalCents)}. Se revertirá la caja o el saldo del cliente.
            </p>

            <input
              type="text"
              required
              autoFocus
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Motivo de la anulación *"
              className="mt-3 h-12 w-full rounded-2xl border border-ink-200 px-4 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />

            {pinEnabled ? (
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={6}
                value={voidPin}
                onChange={(event) => setVoidPin(event.target.value)}
                placeholder="PIN de autorización *"
                className="mt-2 h-12 w-full rounded-2xl border border-ink-200 px-4 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
              />
            ) : null}

            {voidError ? (
              <p className="mt-2 text-xs font-semibold text-rose-700">{voidError}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="h-12 rounded-2xl bg-ink-100 text-sm font-bold text-ink-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={voiding}
                className="h-12 rounded-2xl bg-rose-600 text-sm font-bold text-white active:bg-rose-700 disabled:bg-ink-200"
              >
                {voiding ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-ink-700">{title}</p>
      <p className="mt-2 text-sm text-ink-500">{description}</p>
    </div>
  );
}
