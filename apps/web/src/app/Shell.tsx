import { useLiveQuery } from 'dexie-react-hooks';
import { NavLink, Outlet } from 'react-router-dom';
import { readSetting } from '../db/db';
import { getOpenCashSession } from '../domain/cash';
import { CalculatorLauncher } from '../features/calculator/CalculatorLauncher';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Vender',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M6 7h12l1.5 12.5a1 1 0 0 1-1 1.1H5.5a1 1 0 0 1-1-1.1L6 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
    )
  },
  {
    to: '/cobrar',
    label: 'Cobrar',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
        <path d="M16 13.5v3M14.5 15h3" />
      </svg>
    )
  },
  {
    to: '/clientes',
    label: 'Clientes',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5.8" />
        <path d="M17.5 14.5A5.5 5.5 0 0 1 20.5 19" />
      </svg>
    )
  },
  {
    to: '/mas',
    label: 'Más',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
    )
  }
];

function CashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 11h18" />
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  );
}

export function Shell() {
  const identity = useLiveQuery(
    async () => ({
      name: await readSetting('businessName'),
      subtitle: await readSetting('businessSubtitle')
    }),
    [],
    { name: '', subtitle: '' }
  );
  const session = useLiveQuery(
    async () => (await getOpenCashSession()) ?? null,
    [],
    undefined
  );

  return (
    <div className="flex h-dvh flex-col bg-ink-100">
      <header className="pt-safe shrink-0 border-b border-ink-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink-900">
              {identity.name || 'Mariel'}
            </p>
            <p className="truncate text-[11px] text-ink-500">
              {identity.subtitle || 'Mostrador y cuentas'}
            </p>
          </div>

          <NavLink
            to="/caja"
            title={session ? 'Caja abierta' : 'Caja cerrada'}
            className={({ isActive }) =>
              [
                'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-bold transition-colors',
                isActive
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-100 text-ink-700 active:bg-ink-200'
              ].join(' ')
            }
          >
            <span
              className={[
                'h-2 w-2 rounded-full',
                session ? 'bg-brand-500' : 'bg-ink-300'
              ].join(' ')}
            />
            <CashIcon />
            Caja
          </NavLink>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>

      <nav className="pb-safe shrink-0 border-t border-ink-200 bg-white" aria-label="Principal">
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                    isActive ? 'text-brand-700' : 'text-ink-400'
                  ].join(' ')
                }
              >
                <span className="h-6 w-6">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <CalculatorLauncher />
    </div>
  );
}
