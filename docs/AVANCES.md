# Bitácora de avances — Sistema Mariel

Este archivo es el estado vivo del proyecto. Se actualiza al terminar cada sesión de trabajo.
No reemplaza al documento maestro ni al registro de decisiones.

## Estado general

| Fase | Estado |
|---|---|
| 0. Documentación y arquitectura | Completada |
| 1. Scaffold y shell móvil | Completada |
| 2. Cobro rápido (keypad, cambio, pagos) | Componentes y validaciones listos; falta guardar la venta |
| 3. Venta y caja mínima | Pendiente |
| 4. Cierre y reportes | Pendiente |
| 5. Cuentas de clientes | Pendiente |
| 6. Servicios y remesas | Pendiente |
| 7. Respaldo cifrado | Infraestructura remota creada; integración pendiente |
| 8. Auditoría y endurecimiento | Pendiente |
| 9. Pruebas E2E e instalación | Pendiente |

## Próximo paso

1. Revisar y aprobar el esquema Dexie v2 (`apps/web/src/db/db.ts`).
2. Pasar a la fase 2: sesión de caja, catálogo persistente y venta transaccional.
3. Integrar el cobro ya construido con Dexie en una sola transacción.

Antes de codificar, revisar `AGENTS.md` y `docs/PROYECTO.md`.

---

## 2026-11-16 — Sesión 0: contexto y arquitectura

**Objetivo:** definir el sistema y dejar contexto persistente para las siguientes sesiones.

**Hecho:**
- Se analizó el requerimiento original y se adaptó a uso móvil unipersonal.
- Se eligió PWA Android con Dexie local, sin backend operativo.
- Se definió Supabase solo como respaldo cifrado.
- Se eliminó la impresión de tickets por decisión del usuario.
- Se definió moneda BOB, formato `es-BO`, montos en centavos.
- Se definió el modelo de datos inicial y las reglas de caja.
- Se creó la documentación base.

**Archivos creados:**
- `AGENTS.md`
- `README.md`
- `docs/PROYECTO.md`
- `docs/DECISIONES.md`
- `docs/AVANCES.md`
- `.gitignore`

**Decisiones tomadas:**
- ADR-001 a ADR-017.

**Pruebas:** no aplica; todavía no hay código.

**Pendiente / siguiente:**
- Scaffold React + Vite + TypeScript + Tailwind + PWA.
- Esquema Dexie v1 y tipos.
- Componentes de cobro móvil.

---

## 2026-11-16 — Sesión 0.1: repositorio remoto

**Objetivo:** conectar el proyecto con GitHub y publicar la documentación inicial.

**Hecho:**
- Se agregó `origin` apuntando a `https://github.com/OsviTap/SistemaCuentas.git`.
- Se renombró la rama local `master` a `main`.
- Se publicó el commit inicial con toda la documentación.
- Se actualizó el README y el contexto con la ubicación del repositorio.

**Decisiones:**
- Rama principal única: `main`.
- El repositorio no contiene secretos ni bases locales.

**Pruebas:** `git push` completado; el remoto aceptó la rama `main`.

**Pendiente / siguiente:**
- Scaffold de la PWA y primer bloque de cobro móvil.

---

## 2026-11-16 — Sesión 0.2: MCP de Supabase

**Objetivo:** conectar OpenCode con el proyecto Supabase `lmktjrvmfvirsactdwqe`.

**Hecho:**
- Se revisó la configuración global `C:\Users\johan\.config\opencode\opencode.jsonc`.
- Se adaptó el snippet de Supabase al formato de OpenCode V2:
  - `mcp.servers.supabase` en lugar de `mcp.supabase`.
  - Se omitió `enabled: true`; en V2 el campo correcto es `disabled`.
- El servidor remoto quedó registrado con el endpoint MCP del proyecto.
- `opencode mcp list` detecta `supabase` y reporta `needs authentication`.

**Pendiente:**
- Autenticar con `/mcps` → `supabase` → iniciar sesión en el navegador.
- Verificar conexión y listar tablas/recursos del proyecto.
- Crear bucket privado y tabla de manifiesto de respaldos cuando se implemente la fase 6.
- Evaluar la instalación opcional de `supabase/agent-skills` después de validar la conexión.

**Notas:**
- No se instalaron skills de Supabase todavía.
- No se guardaron secretos en el repositorio; la autenticación OAuth vive fuera de la configuración.

---

## 2026-11-16 — Sesión 0.3: infraestructura de respaldo en Supabase

**Objetivo:** verificar la conexión y preparar el almacenamiento remoto de respaldos.

**Hecho:**
- Se verificó el proyecto Supabase `lmktjrvmfvirsactdwqe`.
- El proyecto estaba limpio: sin tablas, migraciones ni avisos de seguridad.
- Se creó la migración `20261116222406_backup_infrastructure`.
- Se creó el bucket privado `mariel-backups` con límite de 50 MB por archivo.
- Se creó `public.backup_manifests` con RLS por `auth.uid()`.
- Se crearon políticas de Storage limitadas a la carpeta del usuario.
- Se verificaron tabla, bucket, políticas y asesores de seguridad.
- Se replicó la migración en `supabase/migrations/`.
- Se documentó todo en `docs/SUPABASE.md`.

**Decisiones:**
- El bucket es privado y solo guarda blobs cifrados.
- Los manifiestos son inmutables: SELECT, INSERT y DELETE; sin UPDATE.
- La ruta incluye el `user_id` como primer segmento para que RLS aísle a cada usuario.
- No se guardó ninguna clave en el repositorio.

**Pruebas:**
- `opencode mcp list`: conectado.
- `list_tables`: `backup_manifests` con RLS habilitado.
- `get_advisors(security)`: sin hallazgos.
- `get_advisors(health)`: sin hallazgos.
- `get_advisors(performance)`: aviso informativo de índice sin uso; esperado porque la tabla está vacía.
- Bucket y políticas verificados por consulta SQL.

**Pendiente / siguiente:**
- Crear la cuenta de la dueña y desactivar el registro público.
- Integrar subida/descarga cifrada desde la PWA.
- Probar RLS con dos usuarios y restaurar una copia en un contexto limpio.
- Scaffold de la PWA y primer bloque de cobro móvil.

---

## 2026-11-16 — Sesión 0.4: revisión del acceso a Supabase

**Objetivo:** verificar el estado de autenticación después de los cambios en el dashboard.

**Hecho:**
- Se consultó `auth/v1/settings` y `auth.users`.
- `auth.users` sigue vacía: no existe ninguna cuenta.
- Se detectó que se desactivó el **proveedor Email** (`external.email = false`), no el interruptor de registro público.
- Efecto actual: nadie puede registrarse ni iniciar sesión, porque no hay método de acceso habilitado.
- Se documentó la configuración final requerida para la fase 6.

**Decisiones:**
- Dejar la cuenta de respaldo y la passphrase para la fase 6, por pedido del usuario.
- No se crea ninguna cuenta ahora.
- El proyecto permanece cerrado mientras el proveedor Email esté apagado.

**Pruebas:**
- `GET /auth/v1/settings`: `disable_signup = false`, `external.email = false`, `mailer_autoconfirm = false`.
- `select count(*) from auth.users`: `0`.

**Pendiente / siguiente:**
- Fase 6: reactivar Email, apagar `Allow new users to sign up`, crear la cuenta y confirmar el correo.
- Scaffold de la PWA y primer bloque de cobro móvil.

---

## 2026-11-17 — Sesión 1: scaffold, base local y cobro móvil

**Objetivo:** crear la estructura de la PWA, el esquema completo de Dexie y los componentes de cobro; agregar una calculadora rápida con historial.

**Hecho:**
- Scaffold con npm workspaces en `apps/web`.
- Vite 8, React 19, TypeScript 5.9, Tailwind CSS 4.
- PWA con `vite-plugin-pwa`: manifest, service worker y precache del shell.
- Iconos PWA generados con un script propio sin dependencias externas.
- Shell móvil con barra inferior, áreas seguras y cuatro destinos.
- Esquema Dexie v2 con 20 tablas: clientes, cuentas, ventas, pagos, caja, catálogo, auditoría, respaldo e historial de calculadora.
- Siembra idempotente de configuración y contadores.
- `MoneyKeypad` con teclado propio y límite de monto.
- `ChangeCalculator` con cambio en tipografía grande y sugerencia de denominaciones.
- `PaymentSheet` con efectivo, QR y mixto; valida que la suma sea el total.
- Pantalla de venta de demostración con catálogo temporal en memoria.
- Calculadora rápida con historial local de 50 entradas, abierta desde una pestaña lateral.
- Pruebas unitarias y de IndexedDB con Vitest y `fake-indexeddb`.

**Archivos principales:**
- `package.json`, `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`
- `apps/web/src/app/` — shell, rutas y placeholders
- `apps/web/src/db/db.ts` — esquema y siembra
- `apps/web/src/lib/money.ts`, `dates.ts`, `ids.ts`
- `apps/web/src/components/MoneyKeypad.tsx`
- `apps/web/src/features/checkout/` — pagos, calculadora de cambio, hoja de cobro y venta demo
- `apps/web/src/features/calculator/` — lógica, historial, hoja y lanzador
- `apps/web/scripts/generate-icons.mjs` y `apps/web/public/`

**Decisiones nuevas (ADR):**
- ADR-018 — Calculadora rápida con historial local.

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 53 pruebas en 5 archivos, todas pasan.
- `npm run build`: build de producción con PWA; 16 entradas precacheadas.
- Verificación en navegador: la app carga sin errores de consola; `12,5 × 3 =` devuelve `37,5` y queda en el historial; recuperar una entrada funciona.

**Problemas encontrados:**
- Node 20.17 no soportaba Vite 8. El usuario actualizó a Node 26.13.1.
- `@vitejs/plugin-react` emite avisos de deprecación de `esbuild` en Vite 8. Son informativos y no afectan el build.

**Pendiente / siguiente:**
- Aprobar el esquema local.
- Integrar la venta real en una transacción de Dexie.
- Apertura de caja y catálogo persistente.
- Resolver la navegación definitiva (ver decisión pendiente en `PROYECTO.md`).
- La pantalla de venta actual **no guarda** la venta.

---

## Plantilla para próximas sesiones

```text
## YYYY-MM-DD — Sesión N: título

**Objetivo:**
**Hecho:**
**Archivos tocados:**
**Decisiones nuevas (ADR):**
**Pruebas ejecutadas:**
**Problemas encontrados:**
**Pendiente / siguiente:**
```

## Reglas de actualización

- Cada sesión agrega una entrada al final; no se borra el historial.
- Si una tarea queda a medias, se registra exactamente en qué estado quedó.
- Si se cambia una decisión, se agrega un ADR nuevo en `docs/DECISIONES.md`.
- No marcar una fase como completada sin pruebas o verificación manual.
- Mantener este archivo corto: detalle técnico va en `PROYECTO.md`.
