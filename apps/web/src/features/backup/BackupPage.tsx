import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../lib/dates';
import {
  exportEncryptedBackup,
  restoreEncryptedBackup,
  type BackupKind
} from './snapshot';
import {
  downloadRemoteBackup,
  getOwnerSession,
  isSupabaseConfigured,
  listRemoteBackups,
  signInOwner,
  signOutOwner,
  uploadEncryptedBackup,
  type RemoteBackupManifest
} from './supabaseClient';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function BackupPage() {
  const [kind, setKind] = useState<BackupKind>('quick');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabaseReady = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remoteList, setRemoteList] = useState<RemoteBackupManifest[]>([]);

  useEffect(() => {
    if (!supabaseReady) return;
    void getOwnerSession().then((s) => {
      setSession(s);
      if (s) {
        void listRemoteBackups()
          .then(setRemoteList)
          .catch(() => setRemoteList([]));
      }
    });
  }, [supabaseReady]);

  const handleDownloadLocal = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const exported = await exportEncryptedBackup({ kind, passphrase });
      const blob = new Blob([exported.bytes as BlobPart], {
        type: 'application/octet-stream'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exported.fileName;
      anchor.click();
      URL.revokeObjectURL(url);

      setFeedback(
        `Respaldo cifrado descargado (${formatBytes(exported.byteSize)}). Guarda tu frase de respaldo.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo generar el respaldo.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;

    if (!passphrase.trim()) {
      setError('Escribe la frase de respaldo antes de seleccionar el archivo.');
      return;
    }

    const confirmed = window.confirm(
      'Al restaurar se reemplazarán todos los datos actuales de este teléfono por los del respaldo. ¿Deseas continuar?'
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const buffer = await file.arrayBuffer();
      const snapshot = await restoreEncryptedBackup({
        encryptedBytes: new Uint8Array(buffer),
        passphrase
      });
      setFeedback(
        `Base restaurada correctamente (copia del ${formatDateTime(snapshot.createdAt)}).`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo restaurar el respaldo.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const nextSession = await signInOwner(email, password);
      setSession(nextSession);
      setPassword('');
      const list = await listRemoteBackups();
      setRemoteList(list);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUploadCloud = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const exported = await exportEncryptedBackup({ kind, passphrase });
      await uploadEncryptedBackup(exported);
      const list = await listRemoteBackups();
      setRemoteList(list);
      setFeedback(
        `Respaldo cifrado subido a la nube (${formatBytes(exported.byteSize)}).`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo subir el respaldo.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreCloud = async (manifest: RemoteBackupManifest) => {
    if (busy) return;
    if (!passphrase.trim()) {
      setError('Escribe la frase de respaldo para descifrar la copia.');
      return;
    }

    const confirmed = window.confirm(
      `¿Restaurar la copia del ${formatDateTime(manifest.created_at)}? Reemplazará los datos actuales de este teléfono.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setFeedback(null);

    try {
      const bytes = await downloadRemoteBackup(manifest.object_path);
      const snapshot = await restoreEncryptedBackup({
        encryptedBytes: bytes,
        passphrase
      });
      setFeedback(
        `Base restaurada desde la nube (${formatDateTime(snapshot.createdAt)}).`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo restaurar desde la nube.'
      );
    } finally {
      setBusy(false);
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
            <h1 className="text-2xl font-bold text-ink-900">Respaldo cifrado</h1>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
        <section className="rounded-3xl bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Cifrado en el teléfono
          </p>
          <p className="mt-1 text-xs text-ink-500">
            El respaldo se comprime y cifra con AES-GCM antes de guardarse o subirse.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-ink-100 p-1">
            <button
              type="button"
              onClick={() => setKind('quick')}
              aria-pressed={kind === 'quick'}
              className={[
                'h-10 rounded-xl text-xs font-bold transition-colors',
                kind === 'quick' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Rápido (sin fotos)
            </button>
            <button
              type="button"
              onClick={() => setKind('full')}
              aria-pressed={kind === 'full'}
              className={[
                'h-10 rounded-xl text-xs font-bold transition-colors',
                kind === 'full' ? 'bg-ink-900 text-white' : 'text-ink-600'
              ].join(' ')}
            >
              Completo (con QR)
            </button>
          </div>

          <div className="mt-3">
            <label htmlFor="backup-passphrase" className="block text-xs font-semibold text-ink-600 uppercase">
              Frase secreta de respaldo (mín. 6 caracteres)
            </label>
            <input
              id="backup-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Tu frase secreta…"
              className="mt-1 h-12 w-full rounded-2xl border border-ink-200 bg-ink-50 px-4 text-base text-ink-900 focus:border-brand-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadLocal()}
              disabled={busy}
              className="h-12 rounded-2xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700 disabled:bg-ink-200 disabled:text-ink-400"
            >
              Descargar copia
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="h-12 rounded-2xl bg-ink-900 text-sm font-bold text-white active:bg-ink-800 disabled:bg-ink-200 disabled:text-ink-400"
            >
              Restaurar archivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".enc,.mariel.enc,application/octet-stream"
              onChange={(event) => void handleRestoreFile(event)}
              className="hidden"
            />
          </div>
        </section>

        {feedback ? (
          <p className="rounded-2xl bg-brand-100 px-4 py-3 text-sm font-medium text-brand-900">
            {feedback}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}

        <section className="rounded-3xl bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
            Nube privada (Supabase)
          </p>

          {!supabaseReady ? (
            <p className="mt-2 text-xs text-ink-500">
              Para activar el respaldo automático en la nube, configura{' '}
              <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
              <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> en{' '}
              <code className="font-mono">.env.local</code> y crea la cuenta de la dueña.
            </p>
          ) : !session ? (
            <form onSubmit={(event) => void handleSignIn(event)} className="mt-3 space-y-2">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Correo de la dueña"
                className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña"
                className="h-11 w-full rounded-xl border border-ink-200 px-3 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-12 w-full rounded-xl bg-ink-900 text-sm font-bold text-white active:bg-ink-800"
              >
                Iniciar sesión en Supabase
              </button>
            </form>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between text-xs text-ink-600">
                <span>Conectada como {session.user.email}</span>
                <button
                  type="button"
                  onClick={() => void signOutOwner().then(() => setSession(null))}
                  className="font-semibold text-rose-700"
                >
                  Salir
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleUploadCloud()}
                disabled={busy}
                className="h-12 w-full rounded-2xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700 disabled:bg-ink-200"
              >
                {busy ? 'Procesando…' : 'Subir respaldo cifrado a la nube'}
              </button>

              {remoteList.length > 0 ? (
                <ul className="divide-y divide-ink-100">
                  {remoteList.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink-900">
                          {formatDateTime(item.created_at)}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {item.kind === 'full' ? 'Completo' : 'Rápido'} ·{' '}
                          {formatBytes(item.byte_size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRestoreCloud(item)}
                        disabled={busy}
                        className="h-9 rounded-xl bg-ink-100 px-3 text-xs font-bold text-ink-800 active:bg-ink-200"
                      >
                        Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
