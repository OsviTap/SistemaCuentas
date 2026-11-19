import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { isPinConfigured, verifyOwnerPin } from '../../domain/pin';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinLockGate({ children }: { children: ReactNode }) {
  const pinEnabled = useLiveQuery(() => isPinConfigured(), [], undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pinEnabled === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-ink-100 text-sm text-ink-500">
        Cargando…
      </div>
    );
  }

  if (!pinEnabled || unlocked) {
    return <>{children}</>;
  }

  const handleDigit = (digit: string) => {
    if (checking || pin.length >= 6) return;
    setError(null);
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (checking) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleUnlock = async () => {
    if (checking || pin.length < 4) return;
    setChecking(true);
    setError(null);

    try {
      const ok = await verifyOwnerPin(pin);
      if (ok) {
        setUnlocked(true);
        setPin('');
      } else {
        setError('PIN incorrecto.');
        setPin('');
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-ink-100 px-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Sistema Mariel
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink-900">Ingresa tu PIN</h1>
        </div>

        <div className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-white px-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className={[
                'h-3.5 w-3.5 rounded-full transition-colors',
                index < pin.length ? 'bg-ink-900' : 'bg-ink-200'
              ].join(' ')}
            />
          ))}
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-white text-xl font-bold text-ink-900 active:bg-ink-200"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-ink-200 text-base font-bold text-ink-800 active:bg-ink-300"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-white text-xl font-bold text-ink-900 active:bg-ink-200"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={pin.length < 4 || checking}
            className="h-14 rounded-2xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-400"
          >
            {checking ? '…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
