import { useState } from 'react';
import { CalculatorSheet } from './CalculatorSheet';

/**
 * Pestaña lateral discreta: abre la calculadora rápida desde cualquier pantalla.
 * Se ubica al costado para no tapar el botón de cobrar ni los productos.
 */
export function CalculatorLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir calculadora"
          title="Calculadora"
          className="fixed top-[52%] right-0 z-40 flex h-16 w-11 -translate-y-1/2 items-center justify-center rounded-l-2xl border border-r-0 border-ink-200 bg-white/90 text-ink-500 shadow-lg backdrop-blur-sm active:bg-ink-100"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
            <path d="M8 7h8" />
            <path
              d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01"
              strokeLinecap="round"
              strokeWidth="2.2"
            />
          </svg>
        </button>
      )}

      {open ? <CalculatorSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
