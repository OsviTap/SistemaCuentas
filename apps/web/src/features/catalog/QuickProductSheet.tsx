import { useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { Product } from '../../db/db';
import { CatalogError, createProduct } from '../../domain/catalog';
import { formatBs } from '../../lib/money';

type QuickProductSheetProps = {
  onClose: () => void;
  onCreated: (product: Product) => void;
};

export function QuickProductSheet({ onClose, onCreated }: QuickProductSheetProps) {
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);

    try {
      const product = await createProduct({ name, priceCents });
      onCreated(product);
    } catch (caught) {
      setError(
        caught instanceof CatalogError || caught instanceof Error
          ? caught.message
          : 'No se pudo guardar el producto.'
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-product-title"
        className="pb-safe max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-ink-100"
      >
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xl text-ink-700 active:bg-ink-200"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
              Mostrador
            </p>
            <h2 id="quick-product-title" className="text-lg font-bold text-ink-900">
              Producto rápido
            </h2>
          </div>
        </header>

        <div className="px-4 py-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-700">Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Pan de queso"
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              maxLength={60}
              className="w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-lg font-semibold outline-none focus:border-brand-500"
            />
          </label>

          <div className="mt-4 rounded-3xl bg-ink-900 px-5 py-4 text-white">
            <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
              Precio de venta
            </p>
            <p className="tabular mt-1 text-4xl font-black">{formatBs(priceCents)}</p>
          </div>

          <div className="mt-3">
            <MoneyKeypad valueCents={priceCents} onChange={setPriceCents} />
          </div>

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}

          <p className="mt-3 text-xs text-ink-500">
            Se guarda en el catálogo y se agrega a la venta actual.
          </p>
        </div>

        <div className="sticky bottom-0 border-t border-ink-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || name.trim().length === 0 || priceCents <= 0}
            className={[
              'h-14 w-full rounded-2xl text-lg font-bold transition-colors',
              !saving && name.trim().length > 0 && priceCents > 0
                ? 'bg-brand-600 text-white active:bg-brand-700'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            {saving ? 'Guardando…' : 'Guardar y agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
