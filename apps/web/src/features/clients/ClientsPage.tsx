import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listActiveClients } from '../../domain/clients';
import { formatBs } from '../../lib/money';
import { ClientDetailSheet } from './ClientDetailSheet';
import { ClientFormSheet } from './ClientFormSheet';

export function ClientsPage() {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clients = useLiveQuery(() => listActiveClients(query), [query]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Cuentas</p>
            <h1 className="text-2xl font-bold text-ink-900">Clientes</h1>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="h-11 rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white active:bg-brand-700"
          >
            + Nuevo
          </button>
        </div>

        <div className="mt-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, apodo o teléfono…"
            aria-label="Buscar clientes"
            className="h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {clients === undefined ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
          </div>
        ) : clients.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">
              {query.trim() ? 'No se encontraron clientes' : 'Todavía no hay clientes'}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              {query.trim()
                ? 'Prueba con otro nombre, apodo o teléfono.'
                : 'Agrega clientes para llevar su saldo, depósitos, retiros y cobros con cuenta.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2 pt-1">
            {clients.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => setSelectedClientId(client.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3.5 text-left active:bg-ink-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-ink-900">{client.name}</p>
                    {client.alias || client.phone ? (
                      <p className="truncate text-xs text-ink-500">
                        {[client.alias, client.phone].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-medium tracking-wide text-ink-400 uppercase">
                      Saldo
                    </p>
                    <p
                      className={[
                        'tabular text-base font-black',
                        client.balanceCents > 0
                          ? 'text-brand-700'
                          : client.balanceCents < 0
                            ? 'text-rose-700'
                            : 'text-ink-700'
                      ].join(' ')}
                    >
                      {formatBs(client.balanceCents)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating ? (
        <ClientFormSheet
          onCancel={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            setSelectedClientId(saved.id);
          }}
        />
      ) : null}

      {selectedClientId ? (
        <ClientDetailSheet
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      ) : null}
    </div>
  );
}
