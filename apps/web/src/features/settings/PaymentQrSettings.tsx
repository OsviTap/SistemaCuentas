import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  QrImageError,
  getBusinessQr,
  removeBusinessQr,
  saveBusinessQr,
  validateQrImageFile
} from '../../domain/settings';
import { useBlobUrl } from '../../lib/useBlobUrl';

export function PaymentQrSettings() {
  const attachment = useLiveQuery(async () => (await getBusinessQr()) ?? null, [], undefined);
  const url = useBlobUrl(attachment?.blob);
  const inputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file || saving) return;

    const validationError = validateQrImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveBusinessQr(file);
      setConfirmingRemove(false);
    } catch (caught) {
      setError(
        caught instanceof QrImageError || caught instanceof Error
          ? caught.message
          : 'No se pudo guardar la imagen.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);

    try {
      await removeBusinessQr();
      setConfirmingRemove(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo quitar la imagen.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink-900">QR de cobro</h2>
          <p className="mt-1 text-sm text-ink-500">
            Esta imagen se muestra al cliente cuando cobras por QR.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {attachment === undefined ? (
          <div className="h-48 animate-pulse rounded-2xl bg-ink-100" aria-hidden="true" />
        ) : attachment && url ? (
          <div className="rounded-2xl border border-ink-200 bg-white p-3">
            <img
              src={url}
              alt="QR de cobro cargado"
              className="mx-auto max-h-64 w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-300 bg-ink-50 px-4 text-center">
            <p className="text-sm font-semibold text-ink-600">Sin QR cargado</p>
            <p className="mt-1 text-xs text-ink-500">
              Sube una foto o captura de tu QR desde la galería.
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void handleFile(file);
        }}
      />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={saving}
          className={[
            'h-12 rounded-2xl text-sm font-bold transition-colors',
            saving
              ? 'bg-ink-200 text-ink-400'
              : 'bg-brand-600 text-white active:bg-brand-700'
          ].join(' ')}
        >
          {saving ? 'Guardando…' : attachment ? 'Reemplazar' : 'Subir imagen'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingRemove(true)}
          disabled={!attachment || saving}
          className={[
            'h-12 rounded-2xl text-sm font-semibold',
            attachment && !saving
              ? 'bg-ink-100 text-ink-700 active:bg-ink-200'
              : 'bg-ink-100 text-ink-400'
          ].join(' ')}
        >
          Quitar
        </button>
      </div>

      {confirmingRemove ? (
        <div className="mt-3 rounded-2xl bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-900">¿Quitar el QR cargado?</p>
          <p className="mt-1 text-xs text-rose-700">
            Dejará de mostrarse al cobrar por QR. Puedes volver a subirlo después.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-ink-700 active:bg-ink-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleRemove()}
              className="h-10 flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white active:bg-rose-700"
            >
              Sí, quitar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-100 px-4 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-ink-500">
        Se guarda solo en este teléfono. Se incluirá en el respaldo cifrado. Usa una
        imagen nítida, idealmente cuadrada.
      </p>
    </section>
  );
}
