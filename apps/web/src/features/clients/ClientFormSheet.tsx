import { useEffect, useState } from 'react';
import type { Client } from '../../db/db';
import { ClientError, createClient, updateClient } from '../../domain/clients';

type ClientFormSheetProps = {
  client?: Client;
  onCancel: () => void;
  onSaved: (client: Client) => void;
};

export function ClientFormSheet({ client, onCancel, onSaved }: ClientFormSheetProps) {
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [alias, setAlias] = useState(client?.alias ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const canSave = name.trim().length > 0 && !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const saved = client
        ? await updateClient(client.id, { name, phone, alias, notes })
        : await createClient({ name, phone, alias, notes });
      onSaved(saved);
    } catch (caught) {
      setError(
        caught instanceof ClientError || caught instanceof Error
          ? caught.message
          : 'No se pudo guardar el cliente.'
      );
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label={client ? 'Editar cliente' : 'Nuevo cliente'}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="mt-10 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100"
      >
        <header className="flex shrink-0 items-center justify-between rounded-t-3xl border-b border-ink-200 bg-white px-4 py-3">
          <h2 className="text-lg font-bold text-ink-900">
            {client ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 items-center justify-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            Cancelar
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="client-name" className="block text-xs font-semibold text-ink-600 uppercase">
              Nombre completo *
            </label>
            <input
              id="client-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. María Pérez"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="client-phone" className="block text-xs font-semibold text-ink-600 uppercase">
              Teléfono / WhatsApp (opcional)
            </label>
            <input
              id="client-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Ej. 70012345"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="client-alias" className="block text-xs font-semibold text-ink-600 uppercase">
              Apodo o referencia (opcional)
            </label>
            <input
              id="client-alias"
              type="text"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Ej. Vecina del frente"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="client-notes" className="block text-xs font-semibold text-ink-600 uppercase">
              Notas (opcional)
            </label>
            <input
              id="client-notes"
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observaciones…"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-ink-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="submit"
            disabled={!canSave}
            className={[
              'h-14 w-full rounded-2xl text-base font-bold transition-colors',
              canSave
                ? 'bg-brand-600 text-white active:bg-brand-700'
                : 'bg-ink-200 text-ink-400'
            ].join(' ')}
          >
            {saving ? 'Guardando…' : client ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </footer>
      </form>
    </div>
  );
}
