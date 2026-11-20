import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso discreto cuando el Service Worker descargó una nueva versión de la PWA.
 * Nunca recarga automáticamente para no interrumpir un cobro en curso.
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lg"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold">Nueva versión lista</p>
        <p className="text-xs text-ink-300">Tus datos locales se mantienen intactos.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="h-9 rounded-xl bg-ink-800 px-3 text-xs font-semibold text-ink-200 active:bg-ink-700"
        >
          Después
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="h-9 rounded-xl bg-brand-600 px-3 text-xs font-bold text-white active:bg-brand-700"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
