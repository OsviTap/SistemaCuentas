import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { readSetting, writeSetting } from '../../db/db';
import { PinError, clearOwnerPin, isPinConfigured, setOwnerPin } from '../../domain/pin';
import { PaymentQrSettings } from './PaymentQrSettings';

export function SettingsPage() {
  const [businessName, setBusinessName] = useState('');
  const [businessSubtitle, setBusinessSubtitle] = useState('');
  const [savedIdentity, setSavedIdentity] = useState(false);

  const pinEnabled = useLiveQuery(() => isPinConfigured(), [], false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      readSetting('businessName'),
      readSetting('businessSubtitle')
    ]).then(([name, subtitle]) => {
      setBusinessName(name);
      setBusinessSubtitle(subtitle);
    });
  }, []);

  const handleSaveIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    await writeSetting('businessName', businessName.trim());
    await writeSetting('businessSubtitle', businessSubtitle.trim());
    setSavedIdentity(true);
    window.setTimeout(() => setSavedIdentity(false), 2500);
  };

  const handleSavePin = async (event: React.FormEvent) => {
    event.preventDefault();
    setPinError(null);
    setPinFeedback(null);

    try {
      await setOwnerPin(newPin, pinEnabled ? currentPin : undefined);
      setCurrentPin('');
      setNewPin('');
      setPinFeedback('PIN guardado correctamente.');
    } catch (caught) {
      setPinError(
        caught instanceof PinError || caught instanceof Error
          ? caught.message
          : 'No se pudo guardar el PIN.'
      );
    }
  };

  const handleClearPin = async () => {
    setPinError(null);
    setPinFeedback(null);

    try {
      await clearOwnerPin(currentPin);
      setCurrentPin('');
      setNewPin('');
      setPinFeedback('PIN eliminado.');
    } catch (caught) {
      setPinError(
        caught instanceof PinError || caught instanceof Error
          ? caught.message
          : 'No se pudo quitar el PIN.'
      );
    }
  };

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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <PaymentQrSettings />

        <form onSubmit={(event) => void handleSaveIdentity(event)} className="rounded-3xl bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Negocio
          </p>
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Nombre del negocio (ej. Tienda Mariel)"
              aria-label="Nombre del negocio"
              className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
            <input
              type="text"
              value={businessSubtitle}
              onChange={(event) => setBusinessSubtitle(event.target.value)}
              placeholder="Subtítulo o dirección (opcional)"
              aria-label="Subtítulo del negocio"
              className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm text-ink-900 focus:border-brand-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="mt-3 h-11 w-full rounded-xl bg-ink-900 text-sm font-bold text-white active:bg-ink-800"
          >
            {savedIdentity ? 'Guardado ✓' : 'Guardar nombre'}
          </button>
        </form>

        <form onSubmit={(event) => void handleSavePin(event)} className="rounded-3xl bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Seguridad (PIN)
            </p>
            <span className="text-xs font-semibold text-ink-500">
              {pinEnabled ? 'Activo' : 'Sin PIN'}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {pinEnabled ? (
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={currentPin}
                onChange={(event) => setCurrentPin(event.target.value)}
                placeholder="PIN actual"
                className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
              />
            ) : null}

            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
              placeholder={pinEnabled ? 'Nuevo PIN (4 a 6 dígitos)' : 'Crear PIN (4 a 6 dígitos)'}
              className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
            />
          </div>

          {pinFeedback ? (
            <p className="mt-2 text-xs font-semibold text-brand-700">{pinFeedback}</p>
          ) : null}
          {pinError ? (
            <p className="mt-2 text-xs font-semibold text-rose-700">{pinError}</p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="h-11 flex-1 rounded-xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700"
            >
              {pinEnabled ? 'Cambiar PIN' : 'Activar PIN'}
            </button>
            {pinEnabled ? (
              <button
                type="button"
                onClick={() => void handleClearPin()}
                className="h-11 rounded-xl bg-rose-100 px-4 text-sm font-bold text-rose-800 active:bg-rose-200"
              >
                Quitar
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
