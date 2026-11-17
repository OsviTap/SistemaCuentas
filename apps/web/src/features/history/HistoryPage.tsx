import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { SalePayment } from '../../db/db';
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
  const sales = useLiveQuery(() => listRecentSales(), []);
  const cashMovements = useLiveQuery(() => listRecentCashMovements(), []);
  const accountMovements = useLiveQuery(() => listRecentAccountMovements(), []);

  const loading =
    (tab === 'sales' && sales === undefined) ||
    (tab === 'cash' && cashMovements === undefined) ||
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
                      Anulada
                    </span>
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
          cashMovements && cashMovements.length > 0 ? (
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
                      {CASH_MOVEMENT_LABELS[movement.type] ?? movement.type}
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
          ) : (
            <EmptyState
              title="Todavía no hay movimientos de caja"
              description="Ventas, gastos y ajustes de efectivo o QR se verán aquí."
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
