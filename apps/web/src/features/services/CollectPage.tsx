import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { Service } from '../../db/db';
import { getOpenCashSession } from '../../domain/cash';
import {
  listActiveServices,
  listPendingRemittancesByProvider
} from '../../domain/services';
import { formatBs } from '../../lib/money';
import { RemittancesSheet } from './RemittancesSheet';
import { ServiceCollectSheet } from './ServiceCollectSheet';
import { ServiceFormSheet } from './ServiceFormSheet';

function commissionSummary(service: Service): string {
  const parts: string[] = [];
  if (service.commissionFixedCents > 0) {
    parts.push(formatBs(service.commissionFixedCents));
  }
  if (service.commissionBps > 0) {
    parts.push(`${(service.commissionBps / 100).toFixed(service.commissionBps % 100 === 0 ? 0 : 2)}%`);
  }
  return parts.length > 0 ? `Comisión ${parts.join(' + ')}` : 'Sin comisión';
}

export function CollectPage() {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [showRemittances, setShowRemittances] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [lastFolio, setLastFolio] = useState<string | null>(null);

  const openSession = useLiveQuery(
    async () => (await getOpenCashSession()) ?? null,
    [],
    undefined
  );
  const services = useLiveQuery(() => listActiveServices(query), [query]);
  const pendingRemittances = useLiveQuery(() => listPendingRemittancesByProvider(), []);
  const pendingCount = pendingRemittances?.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
              Mostrador
            </p>
            <h1 className="text-2xl font-bold text-ink-900">Cobrar servicios</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRemittances(true)}
              className="relative h-11 rounded-2xl bg-white px-3 text-sm font-bold text-ink-800 active:bg-ink-200"
            >
              Remesas
              {pendingCount > 0 ? (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-black text-white">
                  {pendingCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="h-11 rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white active:bg-brand-700"
            >
              + Nuevo
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar servicio o empresa…"
            aria-label="Buscar servicios"
            className="h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {openSession === null ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-900">
            <span className="font-medium">Abre la caja para cobrar servicios.</span>
            <Link
              to="/caja"
              className="shrink-0 rounded-xl bg-amber-900 px-3 py-1.5 text-xs font-bold text-white"
            >
              Abrir caja
            </Link>
          </div>
        ) : null}

        {lastFolio ? (
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-brand-100 px-4 py-3 text-sm font-semibold text-brand-900">
            <span>Servicio cobrado · Folio {lastFolio}</span>
            <button
              type="button"
              onClick={() => setLastFolio(null)}
              className="text-xs font-bold underline"
            >
              Ocultar
            </button>
          </div>
        ) : null}

        {services === undefined ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="h-24 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
          </div>
        ) : services.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">
              {query.trim() ? 'No hay servicios que coincidan' : 'Todavía no hay servicios'}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Crea servicios como Luz, Agua o Recargas con su empresa y comisión.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2 pt-1">
            {services.map((service) => (
              <li key={service.id}>
                <button
                  type="button"
                  onClick={() => setSelectedService(service)}
                  disabled={openSession === null}
                  className="flex min-h-24 w-full flex-col justify-between rounded-2xl bg-white p-3.5 text-left active:bg-ink-50 disabled:opacity-60"
                >
                  <div>
                    <p className="line-clamp-2 text-sm font-bold text-ink-900">
                      {service.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-ink-500">
                      {service.providerName}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-brand-700">
                    {commissionSummary(service)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating ? (
        <ServiceFormSheet
          onCancel={() => setCreating(false)}
          onSaved={() => setCreating(false)}
        />
      ) : null}

      {selectedService ? (
        <ServiceCollectSheet
          service={selectedService}
          onCancel={() => setSelectedService(null)}
          onCollected={(folio) => {
            setSelectedService(null);
            setLastFolio(folio);
          }}
        />
      ) : null}

      {showRemittances ? (
        <RemittancesSheet onClose={() => setShowRemittances(false)} />
      ) : null}
    </div>
  );
}
