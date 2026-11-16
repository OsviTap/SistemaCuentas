# Supabase — Respaldo cifrado

**Estado:** proyecto creado, MCP conectado y autenticado, infraestructura de respaldo aplicada.  
**Fecha:** 2026-11-16

## 1. Proyecto

| Dato | Valor |
|---|---|
| Project ref | `lmktjrvmfvirsactdwqe` |
| URL | `https://lmktjrvmfvirsactdwqe.supabase.co` |
| Uso | Solo respaldo cifrado y autenticación |
| Base operativa | No. La base operativa vive en Dexie, en el teléfono |

Supabase **no participa** en ventas, caja, cuentas de clientes ni consultas diarias.

## 2. MCP de OpenCode

- Configuración global: `~/.config/opencode/opencode.jsonc`
- Servidor: `supabase`
- Formato V2: `mcp.servers.supabase`
- Estado: conectado y autenticado.

## 3. Esquema remoto

### Bucket

- Nombre: `mariel-backups`
- Privado: `public = false`
- Límite por archivo: 50 MB
- MIME permitidos:
  - `application/octet-stream`
  - `application/gzip`
  - `application/zip`
  - `application/json`
- Convención de ruta:
  ```text
  {user_id}/{device_id}/{timestamp}-{kind}.mariel.enc
  ```

### Tabla `public.backup_manifests`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `user_id` | uuid | FK a `auth.users`, borrado en cascada |
| `device_id` | text | Identificador del teléfono |
| `object_path` | text | Único; ruta del blob |
| `kind` | text | `quick` o `full` |
| `schema_version` | integer | Versión del esquema local |
| `app_version` | text | Versión de la PWA |
| `byte_size` | bigint | Tamaño del blob cifrado |
| `sha256` | text | Hash de 64 caracteres |
| `created_at` | timestamptz | Fecha de la copia |

### RLS

- `SELECT`, `INSERT` y `DELETE` solo para el dueño (`auth.uid() = user_id`).
- Sin política de `UPDATE`: los manifiestos son inmutables.
- `anon` no tiene permisos sobre la tabla.
- Las políticas de Storage validan que el primer segmento de la ruta sea el `user_id`.

### Migración

- Versión remota: `20261116222406`
- Nombre: `backup_infrastructure`
- Archivo local: `supabase/migrations/20261116222406_backup_infrastructure.sql`

## 4. Autenticación

- La dueña tendrá una cuenta de Supabase con email y contraseña.
- La autenticación se usa solo para respaldar y restaurar.
- La app se desbloquea con PIN local; no depende de Supabase para abrir.
- Después de crear la cuenta de la dueña, se debe desactivar el registro público en Supabase para evitar altas ajenas.
- No se debe crear ni compartir un usuario genérico.

## 5. Integración en la app (pendiente)

Variables previstas en `.env.local`:

```env
VITE_SUPABASE_URL=https://lmktjrvmfvirsactdwqe.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Reglas:

- Solo se usa la **publishable key** en el cliente.
- La `service_role` nunca va al frontend ni al repositorio.
- El snapshot se comprime y se cifra antes de subir.
- La passphrase de respaldo se deriva con PBKDF2-SHA-256 y AES-GCM.
- La app debe funcionar si Supabase no está disponible.

## 6. Flujo previsto

1. La dueña inicia sesión.
2. La app crea un snapshot de Dexie.
3. Comprime con gzip.
4. Cifra con AES-GCM.
5. Sube al bucket en `{user_id}/{device_id}/...`.
6. Inserta el manifiesto.
7. Si hay error de red, deja el respaldo pendiente y reintenta.
8. Rota copias antiguas según retención.

## 7. Restauración

1. Instalar la PWA en el teléfono nuevo.
2. Iniciar sesión.
3. Listar manifiestos del usuario.
4. Descargar el blob.
5. Descifrar con la passphrase.
6. Validar hash y versión de esquema.
7. Confirmar reemplazo de la base local.
8. Registrar auditoría de restauración.

## 8. Pruebas pendientes

- [ ] Crear la cuenta de la dueña y desactivar registro público.
- [ ] Iniciar sesión desde la PWA.
- [ ] Subir un blob cifrado de prueba.
- [ ] Listar y descargar el blob.
- [ ] Verificar que otro usuario no puede leerlo.
- [ ] Probar restauración completa en un contexto limpio.
- [ ] Verificar retención y borrado de copias antiguas.

## 9. Avisos

- El proyecto no tenía tablas ni migraciones antes de esta infraestructura.
- Los asesores de seguridad de Supabase no reportaron problemas después de la migración.
- No se guardaron secretos en el repositorio.
