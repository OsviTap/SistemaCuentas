-- Sistema Mariel — infraestructura de respaldo cifrado
-- Versión remota: 20261116222406
-- Aplicada vía Supabase MCP el 2026-11-16.
--
-- Los archivos del bucket son blobs cifrados en el cliente.
-- Supabase nunca recibe datos legibles.

create table if not exists public.backup_manifests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  object_path text not null unique,
  kind text not null default 'quick' check (kind in ('quick', 'full')),
  schema_version integer not null check (schema_version > 0),
  app_version text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (char_length(sha256) = 64),
  created_at timestamptz not null default now()
);

create index if not exists backup_manifests_user_created_idx
  on public.backup_manifests (user_id, created_at desc);

comment on table public.backup_manifests is
  'Metadatos de snapshots cifrados de Sistema Mariel. Los datos legibles nunca se guardan aquí.';

alter table public.backup_manifests enable row level security;

revoke all on table public.backup_manifests from anon;
grant select, insert, delete on table public.backup_manifests to authenticated;

drop policy if exists "backup_manifests_select_own" on public.backup_manifests;
create policy "backup_manifests_select_own"
  on public.backup_manifests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "backup_manifests_insert_own" on public.backup_manifests;
create policy "backup_manifests_insert_own"
  on public.backup_manifests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "backup_manifests_delete_own" on public.backup_manifests;
create policy "backup_manifests_delete_own"
  on public.backup_manifests for delete
  to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mariel-backups',
  'mariel-backups',
  false,
  52428800,
  array['application/octet-stream', 'application/gzip', 'application/zip', 'application/json']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mariel_backups_select_own" on storage.objects;
create policy "mariel_backups_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'mariel-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "mariel_backups_insert_own" on storage.objects;
create policy "mariel_backups_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'mariel-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "mariel_backups_delete_own" on storage.objects;
create policy "mariel_backups_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'mariel-backups'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
