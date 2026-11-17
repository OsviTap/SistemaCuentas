import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { getOpenCashSession } from '../domain/cash';

type MenuLink = {
  to: string;
  title: string;
  description: string;
};

const MENU: MenuLink[] = [
  {
    to: '/mas/historial',
    title: 'Historial',
    description: 'Ventas, caja y cuentas de clientes.'
  },
  {
    to: '/mas/ajustes',
    title: 'Ajustes',
    description: 'QR de cobro y preferencias del negocio.'
  }
];

export function MorePage() {
  const session = useLiveQuery(
    async () => (await getOpenCashSession()) ?? null,
    [],
    undefined
  );

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Sistema</p>
        <h1 className="text-2xl font-bold text-ink-900">Más</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <Link
          to="/caja"
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 active:bg-ink-100"
        >
          <span
            className={[
              'h-2.5 w-2.5 shrink-0 rounded-full',
              session ? 'bg-brand-500' : 'bg-ink-300'
            ].join(' ')}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink-900">
              {session ? 'Caja abierta' : 'Caja cerrada'}
            </span>
            <span className="block text-xs text-ink-500">
              {session
                ? `Sesión ${session.number} · ${session.openingCashCents > 0 ? 'con efectivo inicial' : 'sin efectivo inicial'}`
                : 'Abre la caja para empezar a cobrar.'}
            </span>
          </span>
          <span className="text-lg text-ink-400">›</span>
        </Link>

        <ul className="mt-3 space-y-2">
          {MENU.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 active:bg-ink-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-900">{item.title}</span>
                  <span className="block text-xs text-ink-500">{item.description}</span>
                </span>
                <span className="text-lg text-ink-400">›</span>
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
          Próximamente
        </h2>
        <ul className="space-y-2">
          <li className="rounded-2xl bg-white/60 px-4 py-4">
            <p className="text-sm font-semibold text-ink-600">Respaldo cifrado</p>
            <p className="text-xs text-ink-500">
              Copia de seguridad en Supabase, cifrada en el teléfono.
            </p>
          </li>
          <li className="rounded-2xl bg-white/60 px-4 py-4">
            <p className="text-sm font-semibold text-ink-600">Auditoría</p>
            <p className="text-xs text-ink-500">
              Historial de acciones sensibles y anulaciones.
            </p>
          </li>
        </ul>

        <p className="mt-6 text-center text-xs text-ink-400">
          Sistema Mariel · datos guardados en este teléfono
        </p>
      </div>
    </div>
  );
}
