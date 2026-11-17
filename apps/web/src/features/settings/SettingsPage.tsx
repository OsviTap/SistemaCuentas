import { Link } from 'react-router-dom';
import { PaymentQrSettings } from './PaymentQrSettings';

export function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Link
            to="/mas"
            aria-label="Volver a Más"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-700 active:bg-ink-200"
          >
            ←
          </Link>
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Más</p>
            <h1 className="text-2xl font-bold text-ink-900">Ajustes</h1>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <PaymentQrSettings />

        <div className="mt-3 rounded-2xl border border-dashed border-ink-300 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-ink-700">Más ajustes</p>
          <p className="mt-1 text-xs text-ink-500">
            Nombre del negocio, denominaciones y PIN se agregarán en las siguientes fases.
          </p>
        </div>
      </div>
    </div>
  );
}
