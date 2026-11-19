# Bitácora de avances — Sistema Mariel

Este archivo es el estado vivo del proyecto. Se actualiza al terminar cada sesión de trabajo.
No reemplaza al documento maestro ni al registro de decisiones.

## Estado general

| Fase | Estado |
|---|---|
| 0. Documentación y arquitectura | Completada |
| 1. Scaffold y shell móvil | Completada |
| 2. Cobro rápido (keypad, cambio, pagos) | Completada |
| 3. Venta y caja mínima | Completada |
| 4. Cierre y reportes | Completada (arqueo, cierre Z, reporte X/Z y compartir para WhatsApp) |
| 5. Cuentas de clientes | Completada (alta, edición, desactivación, depósitos, retiros y pago con saldo) |
| 6. Servicios y remesas | Completada (catálogo, comisiones, cobro con suministro y remesas a empresas) |
| 7. Respaldo cifrado | Cifrado/descifrado local, snapshot/restauración y cliente Supabase listos; falta configurar `.env.local` y cuenta de la dueña |
| 8. Auditoría y endurecimiento | Completada (auditoría visible, anulaciones con reverso y PIN local PBKDF2) |
| 9. Pruebas E2E e instalación | Pendiente |

## Próximo paso

1. Configurar `.env.local` + cuenta de la dueña en Supabase para probar la subida en la nube.
2. Pruebas E2E e instalación en dispositivo móvil (Fase 9).

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

## 2026-11-17 — Sesión 2: venta real, caja y QR de cobro

**Objetivo:** convertir el mostrador de demostración en una venta real guardada en Dexie, con apertura de caja, catálogo persistente, imagen del QR de cobro e historial de movimientos.

**Hecho:**
- Navegación definitiva: **Caja** en la barra superior; **Vender / Cobrar / Clientes / Más** en la barra inferior.
- **Cobrar** queda como entrada de servicios con un aviso honesto de próxima fase.
- Apertura de sesión de caja con efectivo inicial; una sola sesión abierta a la vez.
- Totales de la sesión calculados desde el libro de caja: efectivo esperado, QR esperado, ventas.
- Catálogo persistente con búsqueda sin acentos ni mayúsculas.
- Botón `+` de producto rápido: nombre y precio, guarda en el catálogo y agrega al carrito.
- Venta transaccional en una sola transacción Dexie: venta, líneas, pagos, movimientos de caja, folio y auditoría.
- Folio `YYYY-NNNN` con año local de Bolivia.
- Pagos en efectivo, QR y mixto; validación estricta de que la suma sea el total.
- La caja suma el monto aplicado; el efectivo recibido y el cambio quedan en el pago.
- Aviso si una referencia QR se repitió en las últimas 24 horas.
- Imagen del QR de cobro en **Más → Ajustes → QR de cobro**: carga desde galería, reducción a 1200 px, JPEG 0.88, reemplazo y eliminación.
- La imagen se muestra al cobrar por QR y en el modo mixto, con opción de ampliarla.
- Historial en **Más → Historial** con pestañas **Ventas / Caja / Cuentas**, de solo lectura.
- Pantalla de caja con últimos movimientos y resumen de la sesión.
- Confirmación de venta con folio, total, métodos, referencia QR y cambio.
- Bloqueo del cobro si la caja está cerrada, con acceso directo para abrirla.

**Archivos principales:**
- `apps/web/src/db/db.ts` — claves nuevas de configuración, dueña local y adjunto de QR.
- `apps/web/src/domain/sales.ts`, `cash.ts`, `catalog.ts`, `settings.ts` — reglas de negocio.
- `apps/web/src/features/checkout/` — venta real, hoja de cobro y tarjeta del QR.
- `apps/web/src/features/catalog/QuickProductSheet.tsx` — producto rápido.
- `apps/web/src/features/cash/CashPage.tsx` — apertura y resumen de caja.
- `apps/web/src/features/history/` — historial y consultas.
- `apps/web/src/features/settings/` — ajustes del QR.
- `apps/web/src/app/Shell.tsx`, `App.tsx`, `MorePage.tsx` — navegación y rutas.

**Decisiones nuevas (ADR):**
- ADR-019 — Navegación con Caja arriba y cuatro destinos abajo.
- ADR-020 — Venta guardada en una sola transacción Dexie.
- ADR-021 — Producto rápido persistente y agregado al carrito.
- ADR-022 — Imagen del QR de cobro guardada en el teléfono.
- ADR-023 — Historial unificado y de solo lectura.

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 76 pruebas en 10 archivos, todas pasan.
- `npm run build`: build de producción con PWA.
- Verificación en navegador:
  - caja abierta con Bs 100;
  - producto rápido «Pan de queso» a Bs 3;
  - venta en efectivo `2026-0001` con cambio de Bs 2;
  - venta por QR `2026-0002` con imagen visible y referencia;
  - venta mixta `2026-0004` (Bs 1 efectivo + Bs 2 QR);
  - aviso de referencia QR repetida;
  - pestañas del historial;
  - eliminación del QR desde Ajustes;
  - calculadora `2 + 2 = 4`.
- Sin errores ni avisos en consola.
- La base de prueba se borró y la app quedó en estado limpio.

**Problemas encontrados:**
- Dexie no acepta más de siete tablas en la forma variádica de `transaction`; se pasó un arreglo de tablas.
- El contenedor raíz necesitó una comprobación explícita para TypeScript.
- Los avisos de deprecación de `esbuild` en Vite 8 siguen siendo informativos.

**Pendiente / siguiente:**
- Cierre y arqueo de caja con conteo físico, diferencias y resumen compartible.
- Borrador persistente del carrito e idempotencia de reintentos.
- Cuentas de clientes y pago con saldo.
- Cobro real de servicios y remesas.
- Respaldo cifrado desde la app e inicio de sesión/PIN.

---

## 2026-11-17 — Sesión 3: cierre, arqueo de caja y reportes X/Z

**Objetivo:** completar el ciclo diario de caja con gastos/retiros, arqueo físico por denominaciones, cierre Z inmutable y resumen compartible para WhatsApp.

**Hecho:**
- Dominio de reportes (`getSessionReportData`, `formatCashReportText`) para generar Reporte X (parcial) y Cierre Z (definitivo).
- Dominio de caja ampliado:
  - `sumDenominations` y `denominationType` para conteo boliviano.
  - `recordCashExpense` para registrar gastos del negocio y retiros de la dueña en una transacción Dexie.
  - `closeCashSession` para cerrar la sesión de forma inmutable en una transacción Dexie, guardar `cashDenominations` de cierre, calcular diferencias en efectivo y QR, congelar `reportZText` y registrar auditoría (`cash.close` o `cash.close_with_difference`).
  - `listClosedCashSessions` para consultar sesiones cerradas.
- Utilidad `shareTextReport` / `copyTextToClipboard` con Web Share API y fallback al portapapeles.
- UI móvil en Caja e Historial:
  - `CashExpenseSheet` para gastos y retiros desde la caja abierta.
  - `CloseCashSheet` con conteo por billetes/monedas o monto directo, edición de QR informado, cálculo de diferencias en tiempo real y nota de cierre.
  - `CashReportSheet` para ver, copiar o compartir por WhatsApp el Reporte X o el Cierre Z.
  - Pestaña **Caja** del historial ampliada para listar cierres anteriores y reabrir su Reporte Z congelado.

**Archivos tocados:**
- `apps/web/src/lib/share.ts`
- `apps/web/src/domain/reports.ts`
- `apps/web/src/domain/cash.ts`
- `apps/web/src/domain/cash.test.ts`
- `apps/web/src/features/cash/CashReportSheet.tsx`
- `apps/web/src/features/cash/CashExpenseSheet.tsx`
- `apps/web/src/features/cash/CloseCashSheet.tsx`
- `apps/web/src/features/cash/CashPage.tsx`
- `apps/web/src/features/history/HistoryPage.tsx`
- `docs/AVANCES.md`

**Decisiones nuevas (ADR):**
- Ninguna estructural; se sigue el modelo definido en `docs/PROYECTO.md` y `AGENTS.md`.

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 81 pruebas en 10 archivos, todas pasan.
- `npm run build`: build de producción con PWA (`dist/sw.js`).

**Problemas encontrados:**
- Dexie `transaction` requiere pasar un arreglo de tablas cuando se usan 6 o más tablas.

**Pendiente / siguiente:**
- Cuentas de clientes: alta, búsqueda, depósitos, retiros y pago de venta con saldo.
- Borrador persistente del carrito e idempotencia de reintentos.
- Cobro real de servicios y remesas.
- Respaldo cifrado desde la app e inicio de sesión/PIN.

---

## 2026-11-17 — Sesión 4: cuentas de clientes y cobro con saldo

**Objetivo:** implementar la gestión de cuentas de clientes (alta, edición, desactivación, depósitos, retiros) y el pago de ventas usando el saldo del cliente.

**Hecho:**
- Dominio de clientes (`apps/web/src/domain/clients.ts`):
  - `createClient`, `updateClient`, `deactivateClient` (sin borrado físico, con auditoría).
  - `listActiveClients` (búsqueda normalizada por nombre, apodo o teléfono) y `listClientMovements`.
  - `recordClientCashOperation` para depósitos y retiros en efectivo o QR: actualiza `accountMovements`, `clients.balanceCents`, `cashMovements` y `auditLogs` en una sola transacción Dexie, validando saldo suficiente.
- Cobro con saldo en ventas (`payments.ts` y `sales.ts`):
  - Método `'account'` en `buildPayments` y `createSale`: descuenta el saldo en `clients` y registra `sale_payment` en `accountMovements` sin generar entrada de efectivo/QR en `cashMovements`.
- Interfaz móvil:
  - `ClientsPage`, `ClientFormSheet`, `ClientDetailSheet` y `ClientMovementSheet` conectados en `/clientes`.
  - Cuarta opción **Saldo** en `PaymentSheet` para buscar cliente, ver su saldo y cobrar la venta.

**Archivos tocados:**
- `apps/web/src/domain/clients.ts`
- `apps/web/src/domain/clients.test.ts`
- `apps/web/src/features/checkout/payments.ts`
- `apps/web/src/domain/sales.ts`
- `apps/web/src/features/checkout/PaymentSheet.tsx`
- `apps/web/src/features/clients/ClientsPage.tsx`
- `apps/web/src/features/clients/ClientFormSheet.tsx`
- `apps/web/src/features/clients/ClientDetailSheet.tsx`
- `apps/web/src/features/clients/ClientMovementSheet.tsx`
- `apps/web/src/app/App.tsx`
- `docs/AVANCES.md`

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 85 pruebas en 11 archivos, todas pasan.
- `npm run build`: build de producción con PWA (`dist/sw.js`).

**Pendiente / siguiente:**
- Servicios y remesas (pestaña **Cobrar**).
- Borrador persistente del carrito e idempotencia de reintentos.
- Respaldo cifrado desde la app y cuenta de la dueña.
- PIN de acceso y pruebas E2E.

---

## 2026-11-17 — Sesión 5: servicios y remesas

**Objetivo:** implementar el cobro de servicios (luz, agua, recargas, etc.) separando el monto de la empresa prestataria de la comisión del negocio, junto con el registro de remesas pendientes.

**Hecho:**
- Dominio de servicios (`apps/web/src/domain/services.ts`):
  - `calculateServiceCommission`: comisión fija + porcentual en puntos base (`bps`).
  - `createService`, `deactivateService` y `listActiveServices`.
  - `collectService`: transacción única en Dexie que registra venta (`Sale`), línea de servicio (`SaleItem` con `serviceAmountCents`, `commissionCents`, `providerName`, `supplyNumber`), pagos (`cash`, `qr`, `mixed` o `account`), movimientos de caja/cuenta y auditoría.
  - `listPendingRemittancesByProvider` y `remitProviderServices` para entregar el dinero pendiente a cada empresa prestataria desde efectivo o QR.
- Interfaz móvil en `apps/web/src/features/services/`:
  - `CollectPage`: buscador, servicios activos, badge de remesas pendientes y aviso de caja cerrada.
  - `ServiceFormSheet`: alta de servicio con comisión fija, porcentaje, monto fijo opcional y requisito de suministro.
  - `ServiceCollectSheet`: cálculo en vivo de monto + comisión y cobro mediante `PaymentSheet`.
  - `RemittancesSheet`: listado de pendientes por empresa y registro de remesa.

**Archivos tocados:**
- `apps/web/src/domain/services.ts`
- `apps/web/src/domain/services.test.ts`
- `apps/web/src/features/services/CollectPage.tsx`
- `apps/web/src/features/services/ServiceFormSheet.tsx`
- `apps/web/src/features/services/ServiceCollectSheet.tsx`
- `apps/web/src/features/services/RemittancesSheet.tsx`
- `docs/AVANCES.md`

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 89 pruebas en 12 archivos, todas pasan.
- `npm run build`: build de producción con PWA (`dist/sw.js`).

**Pendiente / siguiente:**
- Respaldo cifrado desde la app y cuenta de la dueña en Supabase.
- Anulaciones/reversos en UI, PIN de acceso y pruebas E2E.

---

## 2026-11-17 — Sesión 6: respaldo cifrado local y cliente Supabase

**Objetivo:** implementar la compresión y cifrado local del respaldo (`fflate` + Web Crypto + Zod), la restauración en otro contexto y la integración cliente con Supabase.

**Hecho:**
- Dependencias instaladas en `@mariel/web`: `fflate`, `@supabase/supabase-js` y `zod`.
- Criptografía local (`apps/web/src/lib/crypto.ts`):
  - `encryptBytes` y `decryptBytes` con cabecera `MARIEL1`, salt de 16 bytes, IV de 12 bytes, PBKDF2-SHA-256 (210.000 iteraciones) y AES-GCM-256.
  - `sha256Hex` para verificación de integridad.
- Snapshot y restauración (`apps/web/src/features/backup/snapshot.ts`):
  - `exportEncryptedBackup`: exporta tablas de Dexie (modo `quick` sin adjuntos o `full` con adjuntos en base64), comprime con `fflate.gzipSync` y cifra en el teléfono.
  - `restoreEncryptedBackup`: descifra, descomprime, valida esquema con Zod y restaura en una sola transacción Dexie registrando `backup.restore` en auditoría.
- Cliente Supabase (`apps/web/src/features/backup/supabaseClient.ts`):
  - Lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, maneja login de dueña, subida al bucket privado `mariel-backups`, inserción en `backup_manifests` y descarga para restauración.
- UI en **Más → Respaldo cifrado** (`BackupPage.tsx` en `/mas/respaldo`).

**Archivos tocados:**
- `package-lock.json`, `apps/web/package.json`
- `apps/web/src/lib/crypto.ts`, `apps/web/src/lib/crypto.test.ts`
- `apps/web/src/features/backup/snapshot.ts`, `apps/web/src/features/backup/snapshot.test.ts`
- `apps/web/src/features/backup/supabaseClient.ts`
- `apps/web/src/features/backup/BackupPage.tsx`
- `apps/web/src/app/App.tsx`, `apps/web/src/app/MorePage.tsx`
- `docs/AVANCES.md`

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 94 pruebas en 14 archivos, todas pasan.
- `npm run build`: build de producción con PWA (`dist/sw.js`).

**Pendiente / siguiente:**
- Configurar `.env.local` con la publishable key de Supabase, reactivar Email provider (con registro público apagado) y crear la cuenta de la dueña.
- Fase 8: auditoría visible, anulaciones/reversos en UI y PIN de acceso/autorización.
- Fase 9: pruebas E2E e instalación móvil.

---

## 2026-11-17 — Sesión 7: auditoría, anulaciones y PIN local

**Objetivo:** completar la capa de control operativo con anulación reversible de ventas, pantalla de auditoría, datos del negocio y PIN local de bloqueo/autorización.

**Hecho:**
- Anulaciones (`voidSale` en `apps/web/src/domain/sales.ts`):
  - Exige motivo y que la venta pertenezca a la sesión abierta.
  - Marca la venta como `voided`, revierte caja (`cashMovements`) o saldo de cliente (`accountMovements` + `clients.balanceCents`) y registra `sale.void` en auditoría dentro de una sola transacción Dexie.
  - Botón **Anular** en `HistoryPage` (con verificación de PIN si está activo).
- Seguridad por PIN (`apps/web/src/domain/pin.ts` y `PinLockGate.tsx`):
  - Hash PBKDF2-SHA-256 con salt único en `users` (nunca se guarda el PIN en claro).
  - Pantalla de bloqueo al iniciar si hay PIN configurado.
  - Configuración/cambio/eliminación de PIN y edición de nombre del negocio en `SettingsPage.tsx`.
- Auditoría (`apps/web/src/features/audit/AuditPage.tsx`):
  - Nueva ruta `/mas/auditoria` desde **Más → Auditoría** con los últimos 100 eventos en hora local de Bolivia.

**Archivos tocados:**
- `apps/web/src/domain/sales.ts`
- `apps/web/src/domain/pin.ts`, `apps/web/src/domain/pin.test.ts`
- `apps/web/src/features/audit/AuditPage.tsx`
- `apps/web/src/features/settings/PinLockGate.tsx`
- `apps/web/src/features/settings/SettingsPage.tsx`
- `apps/web/src/features/history/HistoryPage.tsx`
- `apps/web/src/app/App.tsx`, `apps/web/src/app/MorePage.tsx`
- `docs/AVANCES.md`

**Pruebas ejecutadas:**
- `npm run typecheck`: sin errores.
- `npm test`: 96 pruebas en 15 archivos, todas pasan.
- `npm run build`: build de producción con PWA (`dist/sw.js`).

**Pendiente / siguiente:**
- Configurar `.env.local` con la publishable key de Supabase y crear la cuenta de la dueña.
- Fase 9: pruebas E2E e instalación móvil.

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
