import { NavLink, Outlet } from 'react-router-dom';
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
    to: '/caja',
    label: 'Caja',
    end: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M3 11h18" />
        <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <circle cx="12" cy="15" r="1.5" />
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

export function Shell() {
  return (
    <div className="flex h-dvh flex-col bg-ink-100">
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
