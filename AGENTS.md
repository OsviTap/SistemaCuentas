# Sistema Mariel — Contexto permanente para agentes

> Lee este archivo completo antes de tocar código.
> Detalle amplio: `docs/PROYECTO.md`
> Decisiones y motivos: `docs/DECISIONES.md`
> Estado y bitácora: `docs/AVANCES.md`
> Respaldo en Supabase: `docs/SUPABASE.md`

## 1. Qué es esto

Sistema web/móvil para **una sola persona** que atiende un mostrador en Bolivia.
Sirve para administrar dinero de clientes, tienda rápida, cobro de servicios y caja diaria.
La prioridad es velocidad de operación, precisión del dinero, bajo esfuerzo, historial confiable y respaldo.

No es un ERP, no es un sistema multi-sucursal y **no emite tickets**.

## 2. Decisiones bloqueadas

No reabrir estas decisiones sin que el usuario lo pida explícitamente:

- **Android + PWA instalada**, pensada primero para pantalla táctil y uso con una mano.
- **Un solo celular** como dispositivo operativo. Sin sincronización multi-dispositivo ni usuarios simultáneos en la v1.
- **Local-first**: Dexie/IndexedDB es la base operativa. La app debe vender y registrar sin internet.
- **Supabase solo para respaldo automático cifrado**. Nunca en la ruta crítica de una venta.
- **Moneda boliviana (BOB)**, locale `es-BO`, montos en centavos enteros.
- **No se imprimen tickets**. Sin impresora térmica, Bluetooth, ESC/POS ni formato 58 mm.
- Los resúmenes y cierres se ven en pantalla y se comparten como **texto para WhatsApp**.
- **UI en español**. Código, tablas, campos y tipos en **inglés**.
- **No hay backend operativo** en la v1. No agregar uno sin justificación.
- Nada se elimina físicamente: anulaciones, reversos y auditoría.
- Una **sesión de caja cerrada es inmutable**. Las correcciones se registran como ajustes posteriores.
- El PIN y la auditoría local son control operativo, no seguridad inviolable. No prometer más de eso.

## 3. Modo unipersonal

- La usuaria principal es la dueña/operadora. No diseñar para roles empresariales que no existen.
- Las acciones sensibles se confirman volviendo a pedir el PIN de la dueña o un PIN de autorización configurado.
- Si en el futuro otra persona usa la app, se puede configurar un PIN de supervisor. No imponer esa separación ahora.
- Menos pasos, menos campos y menos confirmaciones innecesarias. Cada fricción debe evitar un error real.

## 4. Flujo principal

Vender producto o servicio → elegir pago (efectivo, QR o mixto) → registrar referencia QR si aplica → cobrar → actualizar caja y cuentas → cerrar caja con conteo físico → compartir resumen → respaldar.

## 5. Reglas de negocio críticas

- Todos los montos son enteros en centavos. Nunca usar `number` con decimales para dinero.
- Una venta, sus líneas, sus pagos, los movimientos de caja, el saldo de cliente y la auditoría se guardan en **una sola transacción de Dexie**.
- `suma de pagos === total de la venta`. Si no coincide, no se guarda.
- Efectivo: registrar monto aplicado, monto recibido y cambio. La caja solo suma el monto aplicado.
- QR: referencia obligatoria de mínimo 4 caracteres. Avisar si se repite en las últimas 24 horas.
- Mixto: son dos pagos separados (efectivo y QR), no un método especial con campos ambiguos.
- Pago con saldo de cliente: movimiento negativo en su cuenta, sin entrada de efectivo a caja.
- Depósito de cliente: sube su saldo y entra efectivo/QR a caja.
- Retiro de cliente: baja su saldo y sale efectivo/QR de caja.
- El libro (`accountMovements`) es la fuente de verdad del saldo. El saldo cacheado en `clients` se actualiza en la misma transacción.
- El efectivo esperado se calcula sumando el libro de caja de la sesión, no reconstruyendo desde ventas.
- Anulación = reverso + motivo + auditoría. Nunca `delete`.
- Catálogo y clientes se desactivan, no se borran.
- No agregar cálculos de comisión o impuestos que no estén definidos.

## 6. Stack

- React 19 + Vite + TypeScript
- Tailwind CSS 4
- Dexie + `dexie-react-hooks`
- React Router
- Zod para validación
- `fflate` + Web Crypto para respaldo cifrado
- Supabase para auth y almacenamiento privado del respaldo
- Vitest + Playwright
- npm workspaces (no hay pnpm instalado)
- Hosting estático de la PWA con HTTPS

### Supabase

- Proyecto: `lmktjrvmfvirsactdwqe`
- URL: `https://lmktjrvmfvirsactdwqe.supabase.co`
- Bucket privado: `mariel-backups` (50 MB por archivo)
- Tabla de manifiestos: `public.backup_manifests` con RLS por `auth.uid()`
- Migración remota: `20261116222406_backup_infrastructure`
- El snapshot se cifra en el teléfono antes de subir.
- La `service_role` nunca se usa en el cliente ni se guarda en el repositorio.
- El proveedor de Email de Supabase está desactivado: hoy nadie puede registrarse ni iniciar sesión. Antes de la fase 6 hay que reactivarlo y apagar `Allow new users to sign up`.
- La cuenta de la dueña no existe todavía.
- La integración de respaldo desde la PWA está pendiente.
- Supabase no es base operativa ni participa en ventas, caja o cuentas.

## 7. Estructura objetivo

```text
apps/web/src/
  app/          # router, providers, shell móvil
  components/   # primitives: Button, Sheet, MoneyKeypad, Toast
  features/
    checkout/   # carrito, cobro, calculadora de cambio
    clients/    # cuentas y movimientos
    cash/       # apertura, gastos, cierre
    catalog/    # productos y servicios
    reports/    # resumen X/Z, WhatsApp
    backup/     # snapshot, cifrado, Supabase
    audit/      # historial de acciones sensibles
  db/           # esquema Dexie, repositorios, migraciones
  domain/       # servicios de venta, caja, cuentas, reglas
  lib/          # dinero, fechas, criptografía, share, ids
docs/
  PROYECTO.md
  DECISIONES.md
  AVANCES.md
```

## 8. Convenciones

- IDs con ULID generados en el teléfono.
- Fechas ISO 8601 en UTC. Mostrar en hora local de Bolivia.
- Tipos y nombres de tablas en inglés. Textos de interfaz en español.
- Montos: `totalCents`, `cashReceivedCents`, `changeCents`.
- Componentes de React en PascalCase; funciones en camelCase.
- Sin librerías de UI pesadas ni animaciones que retrasen el cobro.
- Botones táctiles de al menos 48 px; acciones principales en la zona inferior.
- El teclado numérico de montos es propio. El teclado nativo solo para nombres y referencias.
- Atajos de teclado opcionales para teclado Bluetooth o lector de códigos; no son el camino principal.
- Los reportes no se imprimen. Se comparten con Web Share API o se copian como texto.

## 9. Estado actual

**Fecha:** 2026-11-16

- Repositorio remoto: `https://github.com/OsviTap/SistemaCuentas.git`
- Rama principal: `main`
- Documentación base creada y publicada.
- MCP de Supabase conectado y autenticado.
- Infraestructura remota de respaldo creada: bucket privado, tabla de manifiestos y RLS.
- La integración de respaldo desde la app y la cuenta de la dueña están pendientes.
- Código de la aplicación: **no iniciado**.
- Próximo hito: scaffold del proyecto + `MoneyKeypad` + `ChangeCalculator` + `PaymentSheet` móvil.
- No afirmar que una función existe si no está implementada y probada.

## 10. Protocolo para trabajar sin alucinar

1. Leer este archivo al inicio de cada sesión.
2. Leer `docs/PROYECTO.md` solo si la tarea toca arquitectura, datos, UX o alcance.
3. Revisar `docs/DECISIONES.md` antes de proponer un cambio estructural.
4. Revisar `docs/AVANCES.md` para saber qué está hecho y qué sigue.
5. Si falta una definición, marcarla como **decisión pendiente** y preguntar. No inventar requisitos.
6. Antes de programar, confirmar el alcance del bloque.
7. Al terminar, actualizar `docs/AVANCES.md`.
8. Si cambia una decisión, agregar una entrada nueva a `docs/DECISIONES.md`; no reescribir la historia.
9. Mantener el alcance pequeño: un bloque funcional, probado y documentado por sesión.
10. No introducir backend, impresión, multi-dispositivo ni funciones empresariales sin aprobación.

## 11. Comandos

Aún no hay scaffold. Se documentarán aquí cuando exista `package.json`.
