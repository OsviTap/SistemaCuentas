import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { Product, SalePayment } from '../../db/db';
import { getOpenCashSession } from '../../domain/cash';
import { listProducts } from '../../domain/catalog';
import { createSale, type CreatedSale } from '../../domain/sales';
import { normalizeSearchName } from '../../lib/search';
import { formatBs } from '../../lib/money';
import { QuickProductSheet } from '../catalog/QuickProductSheet';
import { PaymentSheet } from './PaymentSheet';
import type { SalePaymentInput } from './payments';

type CartLine = {
  product: Product;
  quantity: number;
  subtotalCents: number;
};

function methodsSummary(payments: SalePayment[]): string {
  return payments
    .map((payment) =>
      payment.method === 'cash'
        ? `Efectivo ${formatBs(payment.amountCents)}`
        : `QR ${formatBs(payment.amountCents)}`
    )
    .join(' + ');
}

function qrReference(payments: SalePayment[]): string | null {
  const qr = payments.find((payment) => payment.method === 'qr');
  return qr?.qrReference ?? null;
}

function paymentChange(payments: SalePayment[]): number {
  return payments.reduce((sum, payment) => sum + (payment.changeCents ?? 0), 0);
}

export function SellPage() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<CreatedSale | null>(null);

  const products = useLiveQuery(() => listProducts(), [], []);
  const session = useLiveQuery(
    async () => (await getOpenCashSession()) ?? null,
    [],
    undefined
  );

  const lines = useMemo<CartLine[]>(() => {
    return Object.entries(cart).flatMap(([productId, quantity]) => {
      const product = products.find((item) => item.id === productId);
      if (!product || quantity <= 0) return [];
      return [
        {
          product,
          quantity,
          subtotalCents: product.priceCents * quantity
        }
      ];
    });
  }, [cart, products]);

  const visibleProducts = useMemo(() => {
    const query = normalizeSearchName(search);
    if (!query) return products;
    return products.filter((product) => product.searchName.includes(query));
  }, [products, search]);

  const totalCents = lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const hasSession = session !== undefined && session !== null;

  const addProduct = (productId: string) => {
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }));
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  };

  const removeProduct = (productId: string) => {
    setCart((current) => {
      const quantity = (current[productId] ?? 0) - 1;
      const next = { ...current };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = quantity;
      }
      return next;
    });
  };

  const handleConfirm = async (result: {
    payments: SalePaymentInput[];
    changeCents: number;
  }) => {
    const created = await createSale({
      items: lines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity
      })),
      payments: result.payments
    });

    setSheetOpen(false);
    setConfirmed(created);
    setCart({});
    setSearch('');
  };

  const handleProductCreated = (product: Product) => {
    setQuickOpen(false);
    setSearch('');
    addProduct(product.id);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Mostrador</p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink-900">Vender</h1>
          {itemCount > 0 ? (
            <button
              type="button"
              onClick={() => setCart({})}
              className="rounded-lg px-3 py-1 text-sm font-medium text-ink-500 active:bg-ink-200"
            >
              Vaciar
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {session === null ? (
          <div className="mb-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">La caja está cerrada.</p>
            <p className="mt-1">Ábrela para poder cobrar y que el efectivo quede registrado.</p>
            <Link
              to="/caja"
              className="mt-2 inline-flex h-10 items-center rounded-xl bg-amber-900 px-4 text-sm font-bold text-white active:bg-amber-800"
            >
              Abrir caja
            </Link>
          </div>
        ) : null}

        <div className="flex gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-ink-200 bg-white px-4 text-base outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-label="Agregar producto rápido"
            title="Agregar producto rápido"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-bold text-white shadow-sm active:bg-brand-700"
          >
            +
          </button>
        </div>

        {products.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-ink-700">Todavía no hay productos.</p>
            <p className="mt-2 text-sm text-ink-500">
              Usa el botón + para agregar el primero y venderlo de inmediato.
            </p>
            <button
              type="button"
              onClick={() => setQuickOpen(true)}
              className="mt-4 h-12 rounded-2xl bg-brand-600 px-6 text-sm font-bold text-white active:bg-brand-700"
            >
              Agregar producto
            </button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <p className="mt-6 px-2 text-center text-sm text-ink-500">
            No hay productos que coincidan con «{search}».
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {visibleProducts.map((product) => {
              const quantity = cart[product.id] ?? 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product.id)}
                  className="relative flex min-h-24 flex-col justify-between rounded-2xl bg-white p-4 text-left shadow-sm active:bg-ink-100"
                >
                  <span className="text-base leading-tight font-semibold text-ink-900">
                    {product.name}
                  </span>
                  <span className="tabular mt-2 text-lg font-bold text-brand-700">
                    {formatBs(product.priceCents)}
                  </span>
                  {quantity > 0 ? (
                    <span className="absolute top-2 right-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                      {quantity}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {lines.length > 0 ? (
          <section className="mt-4" aria-label="Carrito">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Carrito
            </h2>
            <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
              {lines.map((line) => (
                <li key={line.product.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {line.product.name}
                    </p>
                    <p className="tabular text-xs text-ink-500">
                      {formatBs(line.product.priceCents)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => removeProduct(line.product.id)}
                      aria-label={`Quitar uno de ${line.product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-lg font-bold text-ink-700 active:bg-ink-200"
                    >
                      −
                    </button>
                    <span className="tabular w-6 text-center text-sm font-bold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addProduct(line.product.id)}
                      aria-label={`Agregar uno de ${line.product.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-lg font-bold text-ink-700 active:bg-ink-200"
                    >
                      +
                    </button>
                  </div>
                  <span className="tabular w-20 text-right text-sm font-bold text-ink-900">
                    {formatBs(line.subtotalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : products.length > 0 ? (
          <p className="mt-6 px-2 text-center text-sm text-ink-500">
            Toca un producto para agregarlo.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-ink-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-sm font-medium text-ink-600">
            {itemCount === 0
              ? 'Sin productos'
              : `${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
          </span>
          <span className="tabular text-2xl font-black text-ink-900">{formatBs(totalCents)}</span>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          disabled={totalCents <= 0 || !hasSession}
          className={[
            'h-14 w-full rounded-2xl text-lg font-bold transition-colors',
            totalCents > 0 && hasSession
              ? 'bg-brand-600 text-white active:bg-brand-700'
              : 'bg-ink-200 text-ink-400'
          ].join(' ')}
        >
          {session === null ? 'Abre la caja para cobrar' : 'Cobrar'}
        </button>
      </div>

      {sheetOpen ? (
        <PaymentSheet
          totalCents={totalCents}
          onCancel={() => setSheetOpen(false)}
          onConfirm={handleConfirm}
        />
      ) : null}

      {quickOpen ? (
        <QuickProductSheet
          onClose={() => setQuickOpen(false)}
          onCreated={handleProductCreated}
        />
      ) : null}

      {confirmed ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-ink-100 px-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-3xl text-white">
            ✓
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink-900">Venta guardada</h2>
          <p className="mt-1 text-sm font-medium text-ink-500">Folio {confirmed.sale.folio}</p>
          <p className="tabular mt-2 text-4xl font-black text-ink-900">
            {formatBs(confirmed.sale.totalCents)}
          </p>
          <p className="mt-2 text-sm font-medium text-ink-600">
            {methodsSummary(confirmed.payments)}
          </p>
          {qrReference(confirmed.payments) ? (
            <p className="mt-1 text-sm text-ink-500">
              Ref. QR: {qrReference(confirmed.payments)}
            </p>
          ) : null}
          {paymentChange(confirmed.payments) > 0 ? (
            <p className="tabular mt-2 rounded-xl bg-brand-100 px-4 py-2 text-lg font-bold text-brand-800">
              Cambio {formatBs(paymentChange(confirmed.payments))}
            </p>
          ) : null}

          <p className="mt-6 max-w-xs text-xs text-ink-400">
            La venta quedó en la caja y en el historial de este teléfono.
          </p>

          <button
            type="button"
            onClick={() => setConfirmed(null)}
            className="mt-4 h-14 w-full max-w-xs rounded-2xl bg-ink-900 text-lg font-bold text-white active:bg-ink-800"
          >
            Nueva venta
          </button>
          <Link
            to="/mas/historial"
            className="mt-2 flex h-12 w-full max-w-xs items-center justify-center rounded-2xl bg-white text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Ver historial
          </Link>
        </div>
      ) : null}
    </div>
  );
}
