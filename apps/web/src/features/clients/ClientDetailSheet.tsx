import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { deactivateClient, listClientMovements } from '../../domain/clients';
import { formatDateTime } from '../../lib/dates';
import { ACCOUNT_MOVEMENT_LABELS } from '../../lib/labels';
import { formatBs } from '../../lib/money';
import { ClientFormSheet } from './ClientFormSheet';
import { ClientMovementSheet } from './ClientMovementSheet';

type ClientDetailSheetProps = {
  clientId: string;
  onClose: () => void;
};

export function ClientDetailSheet({ clientId, onClose }: ClientDetailSheetProps) {
  const client = useLiveQuery(() => db.clients.get(clientId), [clientId]);
  const movements = useLiveQuery(() => listClientMovements(clientId, 30), [clientId]);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal' | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (client === undefined) {
    return null;
  }

  if (!client || client.active === 0) {
    return null;
  }

  const handleDeactivate = async () => {
    await deactivateClient(client.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Cuenta de ${client.name}`}
    >
      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink-900">{client.name}</h2>
            {client.phone || client.alias ? (
              <p className="truncate text-xs text-ink-500">
                {[client.alias, client.phone].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cerrar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="rounded-3xl bg-ink-900 px-5 py-4 text-white">
            <p className="text-xs font-medium tracking-wide text-ink-300 uppercase">
              Saldo disponible
            </p>
            <p className="tabular mt-1 text-4xl font-black">
              {formatBs(client.balanceCents)}
            </p>
            {client.notes ? (
              <p className="mt-2 text-xs text-ink-300">{client.notes}</p>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMovementType('deposit')}
              className="h-12 rounded-2xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700"
            >
              + Depósito
            </button>
            <button
              type="button"
              onClick={() => setMovementType('withdrawal')}
              className="h-12 rounded-2xl bg-white text-sm font-bold text-ink-900 active:bg-ink-200"
            >
              − Retiro
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-10 rounded-xl bg-white text-xs font-semibold text-ink-700 active:bg-ink-200"
            >
              Editar datos
            </button>
            {confirmDeactivate ? (
              <button
                type="button"
                onClick={() => void handleDeactivate()}
                className="h-10 rounded-xl bg-rose-600 text-xs font-bold text-white active:bg-rose-700"
              >
                Confirmar desactivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeactivate(true)}
                className="h-10 rounded-xl bg-white text-xs font-semibold text-rose-700 active:bg-rose-50"
              >
                Desactivar cliente
              </button>
            )}
          </div>

          <section className="mt-5">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Movimientos de cuenta
            </h3>

            {movements === undefined ? (
              <div className="h-20 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            ) : movements.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-ink-300 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                Todavía no hay movimientos en esta cuenta.
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
                        {ACCOUNT_MOVEMENT_LABELS[movement.type] ?? movement.type}
                        {movement.description ? ` · ${movement.description}` : ''}
                      </p>
                      <p className="text-xs text-ink-500">
                        {formatDateTime(movement.createdAt)} · Saldo:{' '}
                        <span className="tabular font-medium">
                          {formatBs(movement.balanceAfterCents)}
                        </span>
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
            )}
          </section>
        </div>
      </div>

      {movementType ? (
        <ClientMovementSheet
          client={client}
          type={movementType}
          onCancel={() => setMovementType(null)}
          onSaved={() => setMovementType(null)}
        />
      ) : null}

      {editing ? (
        <ClientFormSheet
          client={client}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
