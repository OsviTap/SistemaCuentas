import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getBusinessQr } from '../../domain/settings';
import { useBlobUrl } from '../../lib/useBlobUrl';

type BusinessQrCardProps = {
  compact?: boolean;
};

/**
 * Imagen del QR del negocio para mostrarla al cliente.
 * Se lee del adjunto local; no se sube a ningún servicio.
 */
export function BusinessQrCard({ compact = false }: BusinessQrCardProps) {
  const [zoom, setZoom] = useState(false);
  const attachment = useLiveQuery(async () => (await getBusinessQr()) ?? null, [], undefined);
  const url = useBlobUrl(attachment?.blob);

  if (attachment === undefined) {
    return (
      <div className="h-24 animate-pulse rounded-2xl bg-ink-200/70" aria-hidden="true" />
    );
  }

  if (!attachment || !url) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold">Todavía no cargaste tu QR.</p>
        <p className="mt-1 text-xs">
          Ve a Más → Ajustes → QR de cobro para agregar la imagen.
        </p>
      </div>
    );
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-2 text-left active:bg-ink-100"
        >
          <img
            src={url}
            alt="QR de cobro del negocio"
            className="h-14 w-14 rounded-lg object-contain"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">Ver QR de cobro</span>
            <span className="block text-xs text-ink-500">Toca para mostrarlo al cliente</span>
          </span>
          <span className="pr-1 text-lg text-ink-400">›</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="w-full rounded-3xl border border-ink-200 bg-white p-3 text-center active:bg-ink-100"
        >
          <img
            src={url}
            alt="QR de cobro del negocio"
            className="mx-auto max-h-64 w-full object-contain"
          />
          <span className="mt-2 block text-xs font-semibold text-ink-500">
            Toca la imagen para ampliarla
          </span>
        </button>
      )}

      {zoom ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <header className="pt-safe shrink-0 border-b border-ink-200 px-3 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(false)}
                aria-label="Cerrar QR"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-xl text-ink-700 active:bg-ink-200"
              >
                ←
              </button>
              <div>
                <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                  Cobro por QR
                </p>
                <h2 className="text-lg font-bold text-ink-900">Muestra este QR al cliente</h2>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center bg-white p-5">
            <img
              src={url}
              alt="QR de cobro del negocio ampliado"
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <footer className="pb-safe shrink-0 border-t border-ink-200 px-4 py-3">
            <button
              type="button"
              onClick={() => setZoom(false)}
              className="h-14 w-full rounded-2xl bg-ink-900 text-lg font-bold text-white active:bg-ink-800"
            >
              Listo
            </button>
          </footer>
        </div>
      ) : null}
    </>
  );
}
