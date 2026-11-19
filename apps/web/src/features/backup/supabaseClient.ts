import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA_VERSION } from '../../db/db';
import type { BackupKind } from './snapshot';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const BACKUP_BUCKET = 'mariel-backups';

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL?.trim() && SUPABASE_KEY?.trim());
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL!.trim(), SUPABASE_KEY!.trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
  return cachedClient;
}

export type RemoteBackupManifest = {
  id: string;
  user_id: string;
  device_id: string;
  object_path: string;
  kind: BackupKind;
  schema_version: number;
  app_version: string;
  byte_size: number;
  sha256: string;
  created_at: string;
};

export async function getOwnerSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ?? null;
}

export async function signInOwner(email: string, password: string): Promise<Session> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase no está configurado en esta compilación.');

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (error || !data.session) {
    throw new Error(error?.message ?? 'No se pudo iniciar sesión.');
  }
  return data.session;
}

export async function signOutOwner(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function uploadEncryptedBackup(input: {
  bytes: Uint8Array;
  byteSize: number;
  sha256: string;
  kind: BackupKind;
  deviceId: string;
  createdAt: string;
}): Promise<RemoteBackupManifest> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase no está configurado.');

  const session = await getOwnerSession();
  if (!session) throw new Error('Inicia sesión para subir el respaldo a la nube.');

  const safeStamp = input.createdAt.replace(/[:.]/g, '-');
  const objectPath = `${session.user.id}/${input.deviceId}/${safeStamp}-${input.kind}.mariel.enc`;

  const { error: uploadError } = await client.storage
    .from(BACKUP_BUCKET)
    .upload(objectPath, new Blob([input.bytes as BlobPart], { type: 'application/octet-stream' }), {
      contentType: 'application/octet-stream',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);
  }

  const { data, error: manifestError } = await client
    .from('backup_manifests')
    .insert({
      user_id: session.user.id,
      device_id: input.deviceId,
      object_path: objectPath,
      kind: input.kind,
      schema_version: SCHEMA_VERSION,
      app_version: '0.1.0',
      byte_size: input.byteSize,
      sha256: input.sha256
    })
    .select()
    .single();

  if (manifestError || !data) {
    throw new Error(
      `Se subió el archivo pero falló el manifiesto: ${manifestError?.message ?? 'error desconocido'}`
    );
  }

  return data as RemoteBackupManifest;
}

export async function listRemoteBackups(): Promise<RemoteBackupManifest[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from('backup_manifests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`No se pudieron listar los respaldos: ${error.message}`);
  }

  return (data ?? []) as RemoteBackupManifest[];
}

export async function downloadRemoteBackup(objectPath: string): Promise<Uint8Array> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase no está configurado.');

  const { data, error } = await client.storage.from(BACKUP_BUCKET).download(objectPath);
  if (error || !data) {
    throw new Error(`No se pudo descargar el respaldo: ${error?.message ?? 'sin datos'}`);
  }

  return new Uint8Array(await data.arrayBuffer());
}
