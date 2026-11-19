import { useEffect, useState } from 'react';
import { MoneyKeypad } from '../../components/MoneyKeypad';
import type { Service } from '../../db/db';
import { calculateServiceCommission, collectService } from '../../domain/services';
import { formatBs } from '../../lib/money';
import { PaymentSheet } from '../checkout/PaymentSheet';

type ServiceCollectSheetProps = {
  service: Service;
  onCancel: () => void;
  onCollected: (folio: string) => void;
};

export function ServiceCollectSheet({
  service,
  onCancel,
  onCollected
}: ServiceCollectSheetProps) {
  const [serviceAmountCents, setServiceAmountCents] = useState(
    service.fixedAmountCents ?? 0
  );
  const [supplyNumber, setSupplyNumber] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const preview =
    serviceAmountCents > 0
      ? calculateServiceCommission(
          serviceAmountCents,
          service.commissionFixedCents,
          service.commissionBps
        )
      : { commissionCents: 0, totalCents: 0 };

  const supplyOk =
    service.requiresSupplyNumber === 0 || supplyNumber.trim().length > 0;
  const canProceed = serviceAmountCents > 0 && supplyOk;

  if (paying) {
    return (
      <PaymentSheet
        totalCents={preview.totalCents}
        onCancel={() => setPaying(false)}
        onConfirm={async ({ payments }) => {
          const result = await collectService({
            serviceId: service.id,
            serviceAmountCents,
            supplyNumber,
            payments
          });
          onCollected(result.sale.folio);
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Cobrar ${service.name}`}
    >
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink-900">{service.name}</h2>
            <p className="truncate text-xs text-ink-500">{service.providerName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cancelar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-3xl bg-ink-900 px-5 py-4 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium tracking-wide text-ink-300 uppercase">
                Total a cobrar
              </span>
              <span className="tabular text-xs text-ink-300">
                Comisión: {formatBs(preview.commissionCents)}
              </span>
            </div>
            <p className="tabular mt-1 text-4xl font-black">
              {formatBs(preview.totalCents)}
            </p>
            <p className="mt-1 text-xs text-ink-300">
              Para {service.providerName}:{' '}
              <span className="tabular font-semibold">
                {formatBs(serviceAmountCents)}
              </span>
            </p>
          </div>

          <div className="mt-3">
            <label htmlFor="collect-supply" className="block text-xs font-semibold text-ink-600 uppercase">
              Número de suministro / teléfono{' '}
              {service.requiresSupplyNumber === 1 ? '*' : '(opcional)'}
            </label>
            <input
              id="collect-supply"
              type="text"
              value={supplyNumber}
              onChange={(event) => setSupplyNumber(event.target.value)}
              placeholder="Ej. 12345678"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          {service.fixedAmountCents ? (
            <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink-700">
              Monto fijo del servicio:{' '}
              <span className="tabular font-bold">
                {formatBs(service.fixedAmountCents)}
              </span>
            </p>
          ) : (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-ink-600 uppercase">
                Monto del servicio (sin comisión)
              </p>
              <MoneyKeypad
                valueCents={serviceAmountCents}
                onChange={setServiceAmountCents}
              />
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-ink-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setPaying(true)}
            disabled={!canProceed}
            className={[
              'h-14 w-full rounded-2xl text-base font-bold transition-colors',
              canProceed
                ? 'bg-brand-600 text-white active:bg-brand-700'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            Cobrar {formatBs(preview.totalCents)}
          </button>
        </footer>
      </div>
    </div>
  );
}
