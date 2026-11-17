# Sistema Mariel — Documento maestro

**Versión:** 1.3  
**Fecha:** 2026-11-17  
**Estado:** venta real, caja de apertura, catálogo, QR de cobro e historial implementados. Cierre de caja pendiente.  
**Uso:** documento canónico. Si el código contradice este documento, el código está mal hasta que se apruebe un cambio.

---

## Índice

1. [Contexto y objetivo](#1-contexto-y-objetivo)
2. [Usuaria y entorno](#2-usuaria-y-entorno)
3. [Decisiones bloqueadas](#3-decisiones-bloqueadas)
4. [Alcance funcional de la v1](#4-alcance-funcional-de-la-v1)
5. [Fuera de alcance](#5-fuera-de-alcance)
6. [Experiencia móvil](#6-experiencia-móvil)
7. [Arquitectura](#7-arquitectura)
8. [Modelo de datos](#8-modelo-de-datos)
9. [Reglas de dinero y caja](#9-reglas-de-dinero-y-caja)
10. [Respaldo y restauración](#10-respaldo-y-restauración)
11. [Seguridad y auditoría](#11-seguridad-y-auditoría)
12. [Stack y estructura](#12-stack-y-estructura)
13. [Plan de implementación](#13-plan-de-implementación)
14. [Pruebas y aceptación](#14-pruebas-y-aceptación)
15. [Riesgos y mitigaciones](#15-riesgos-y-mitigaciones)
16. [Decisiones pendientes](#16-decisiones-pendientes)
17. [Glosario](#17-glosario)

---

## 1. Contexto y objetivo

Sistema web/móvil para **una sola persona** que trabaja en un mostrador en Bolivia. La misma persona:

- administra dinero y cuentas individuales de clientes;
- vende productos de tienda;
- cobra servicios externos (luz, agua, recargas, etc.);
- recibe pagos en efectivo, QR o mixtos;
- abre y cierra caja todos los días;
- necesita historial, control y respaldo.

### Objetivo

Que la operadora pueda registrar todo con el mínimo de toques, sin perder precisión en el dinero, sin depender de internet y con un historial confiable que pueda consultar o restaurar.

### Criterios de éxito

- Una venta de pocos productos se completa en menos de 30 segundos.
- El cambio en efectivo se calcula con un vistazo, sin escribir operaciones.
- El cierre de caja se hace en menos de 5 minutos y muestra la diferencia al instante.
- Una venta nunca se pierde por falta de internet o por cambiar a la app del banco.
- Toda anulación o corrección queda registrada y se puede explicar.
- Si el teléfono se pierde, el negocio se puede restaurar en otro teléfono.

### Principio rector

Menos fricción, no menos control. Cada campo o confirmación extra debe evitar un error real; si no, no se agrega.

---

## 2. Usuaria y entorno

- **Una sola operadora:** dueña del negocio. No hay empleados ni cajeros simultáneos en la v1.
- **Dispositivo:** celular Android, en modo retrato, instalado como PWA.
- **Red:** puede haber internet o no. La operación no depende de la red.
- **Contexto físico:** mostrador, clientes esperando, interrupciones, una mano ocupada.
- **Aplicaciones externas:** la operadora puede cambiar a la app del banco o de mensajería para verificar un QR y volver.
- **Conocimiento técnico:** bajo. La app debe explicarse sola y no pedir configuración innecesaria.

---

## 3. Decisiones bloqueadas

| Decisión | Detalle |
|---|---|
| Android + PWA | Instalada desde el navegador, pantalla completa, actualización automática |
| Un solo celular | No hay sincronización multi-dispositivo ni concurrencia en la v1 |
| Local-first | Dexie/IndexedDB es la base operativa; funciona sin internet |
| Supabase solo para respaldo | Auth y almacenamiento privado de copias cifradas; no es base operativa |
| BOB / `es-BO` | Bolivianos, dos decimales, formato local |
| Sin tickets | No se imprime nada; no hay térmica, ESC/POS ni 58 mm |
| Reportes compartibles | Resumen en pantalla y texto para WhatsApp vía Web Share |
| UI en español | Código, tablas y campos en inglés |
| Centavos enteros | Ningún monto se guarda como decimal flotante |
| Sin borrado físico | Anulaciones, reversos, desactivación y auditoría |
| Sesión cerrada inmutable | Correcciones posteriores se registran en la sesión actual |
| Modo unipersonal | Re-autenticación con PIN, sin roles empresariales innecesarios |
| PIN local | Control operativo, no seguridad inviolable ante manipulación técnica |

Los motivos están en [`DECISIONES.md`](./DECISIONES.md).

---

## 4. Alcance funcional de la v1

### 4.1 Tienda rápida

- Catálogo de productos con: nombre, precio, categoría opcional, disponible/agotado, control de stock opcional.
- Búsqueda predictiva por teclado o texto, sin acentos y sin distinguir mayúsculas.
- Botón `+` de **producto rápido**: nombre y precio con teclado propio; se guarda en el catálogo y se agrega a la venta actual sin salir del mostrador.
- Favoritos o productos frecuentes para agregar en un toque.
- Carrito con cantidades, eliminar línea y total.
- Stock simple:
  - si `controlStock = false`: se muestra `Disponible` / `Agotado` y un botón `+1`;
  - si `controlStock = true`: se descuenta al vender y no se permite vender sin stock.
- No hay kardex, costos, proveedores ni compras en la v1.

### 4.2 Servicios externos

- Catálogo de servicios con:
  - nombre del servicio;
  - empresa prestataria;
  - comisión fija y/o porcentaje;
  - monto fijo opcional (ej. recarga);
  - si requiere número de suministro/medidor.
- Al cobrar un servicio se registra:
  - empresa;
  - número de suministro;
  - monto que corresponde a la empresa;
  - comisión cobrada;
  - total cobrado al cliente.
- Fórmula:
  - `commissionCents = commissionFixedCents + round(serviceAmountCents * commissionBps / 10000)`
  - `totalCents = serviceAmountCents + commissionCents`
- El dinero del servicio es un **pasivo** hasta que se remite a la empresa. La comisión es ingreso del negocio.
- Se puede registrar una **remesa a prestataria**: salida de efectivo/QR que marca los servicios pendientes como remitidos.
- Vista de servicios pendientes por empresa.

### 4.3 Cuentas de clientes

- Alta de cliente: nombre, teléfono y alias opcional. Nada más obligatorio.
- Búsqueda predictiva por nombre o teléfono.
- Saldo actual visible.
- Movimientos:
  - depósito;
  - retiro;
  - pago de una venta con saldo;
  - transferencia entre clientes;
  - ajuste manual con motivo.
- Cada movimiento tiene método: efectivo, QR, mixto o interno.
- Los depósitos y retiros en efectivo/QR afectan la caja.
- Un pago con saldo de cliente no afecta la caja: baja el pasivo del cliente y sube el ingreso de la tienda.
- Por defecto **no se permite saldo negativo**.
- El saldo mostrado es una caché; la fuente de verdad es el libro de movimientos.
- No se elimina un cliente: se desactiva.

### 4.4 Caja diaria

- Solo puede haber una sesión abierta.
- Apertura con fondo de cambio en efectivo y, opcionalmente, desglose por denominación.
- Fondo inicial QR opcional (normalmente 0).
- Durante la sesión se registran:
  - ventas en efectivo y QR;
  - cobros de servicios;
  - depósitos de clientes;
  - retiros de clientes;
  - gastos menores;
  - retiros de la dueña;
  - remesas a prestatarias;
  - ajustes autorizados.
- **Cierre X:** resumen parcial en cualquier momento; no cierra la sesión.
- **Cierre Z:** conteo físico, comparación, diferencias, nota y cierre. Congela la sesión.
- Conteo de cierre por billetes y monedas; total QR informado por la operadora.
- Diferencia positiva = sobrante; negativa = faltante.
- Una sesión cerrada no se edita. Cualquier corrección se registra en la sesión abierta como ajuste post-cierre con vínculo y auditoría.

### 4.5 Pagos

Tres formas visibles: **Efectivo**, **QR**, **Mixto**. Además, si hay cliente seleccionado, **saldo de cliente**.

- Efectivo puro:
  - total a pagar;
  - monto recibido;
  - cambio exacto en pantalla grande;
  - billetes rápidos (20, 50, 100, 200);
  - botón `Exacto`;
  - teclado numérico propio.
- QR:
  - se muestra la imagen del QR del negocio cargada en Ajustes;
  - campo obligatorio de referencia de al menos 4 caracteres;
  - admite últimos 4 dígitos o número completo;
  - aviso si la referencia se repitió en las últimas 24 horas;
  - foto opcional del comprobante, comprimida.
- Mixto:
  - parte en efectivo y parte en QR;
  - la suma debe ser exactamente el total;
  - si hay vuelto, solo aplica a la parte en efectivo.
- Saldo de cliente:
  - valida saldo suficiente;
  - crea movimiento negativo en la cuenta;
  - no genera movimiento de caja.

### 4.6 Reportes

- Resumen diario X y Z en pantalla.
- Contenido mínimo:
  - fecha, sesión, hora de apertura y cierre;
  - cantidad de ventas y total;
  - desglose efectivo/QR;
  - ventas de productos y servicios;
  - comisiones de servicios;
  - depósitos y retiros de clientes;
  - gastos, retiros de la dueña y remesas;
  - efectivo esperado/contado/diferencia;
  - QR esperado/contado/diferencia;
  - anulaciones y ajustes.
- Compartir como texto formateado para WhatsApp con Web Share API.
- Copiar al portapapeles como alternativa.
- No se imprime.

### 4.7 Auditoría

Se registran, como mínimo:

- anulación de venta;
- ajuste manual de saldo de cliente;
- ajuste manual de caja;
- cambio de precio de producto/servicio;
- ajuste de stock;
- cierre con diferencia;
- corrección posterior a un cierre;
- restauración de un respaldo;
- cambio de PIN;
- cambio de passphrase de respaldo;
- eliminación/desactivación de catálogo.

Cada registro incluye actor, fecha, entidad, datos antes/después, motivo y autorización cuando aplique.

### 4.8 Respaldo

- Snapshot automático cifrado a Supabase.
- Se dispara al cerrar caja, cada 2 horas si hubo cambios y de forma manual.
- Restauración completa en un teléfono nuevo.
- Passphrase de respaldo separada del PIN de la app.
- Clave de recuperación disponible para guardar.
- La app funciona sin Supabase; el respaldo queda pendiente y se informa.

### 4.9 Configuración

- Nombre del negocio y datos para el encabezado del resumen.
- Denominaciones de billetes y monedas.
- PIN de la app (6 dígitos por defecto).
- PIN de autorización opcional.
- Cuenta de respaldo y passphrase.
- Permitir o no saldo negativo (por defecto no).
- Imagen del QR de cobro cargada desde la galería, guardada en el teléfono y mostrada al cobrar.

### 4.10 Calculadora rápida

- Utilidad general disponible en cualquier pantalla, no solo durante el cobro.
- Se abre con una pestaña lateral discreta en el borde derecho, pensada para no tapar el botón de cobrar ni los productos.
- Opera con sumas, restas, multiplicaciones, divisiones, porcentajes, cambio de signo y decimales.
- Evalúa en el orden en que se teclea, sin precedencia de operadores, igual que una calculadora de mostrador.
- El resultado se ve en tipografía grande.
- Historial local de los últimos 50 cálculos confirmados con `=`, con expresión, resultado y fecha.
- Un cálculo del historial se puede recuperar con un toque.
- El historial se puede borrar en dos pasos.
- **No participa en ventas, caja ni saldos.** Es una herramienta de consulta; los montos que se registran siguen pasando por la calculadora de cambio del cobro.
- Usa coma flotante de JavaScript redondeada a 12 dígitos significativos. No se usa para guardar dinero.

---

## 5. Fuera de alcance

No implementar en la v1:

- impresión de tickets o cualquier integración con impresoras;
- multi-sucursal;
- múltiples dispositivos simultáneos;
- sincronización en tiempo real;
- facturación fiscal;
- control de IVA/impuestos;
- compras a proveedores, cuentas por pagar complejas o kardex;
- gestión de empleados, turnos o nómina;
- e-commerce o catálogo público;
- programa de puntos/fidelidad;
- integración automática con bancos o APIs de QR;
- envío automático de WhatsApp sin intervención de la usuaria;
- app nativa con Capacitor (solo si luego se justifica).

---

## 6. Experiencia móvil

### 6.1 Principios

- Diseñar para pulgar y para una mano; no para ratón.
- Acciones principales en la zona inferior.
- Botones de al menos 48–56 px.
- Texto grande, alto contraste y montos con números tabulares.
- Flujos críticos a pantalla completa; hojas inferiores solo para acciones secundarias.
- Teclado numérico propio para todo monto.
- Autoguardado del carrito y del cobro en curso.
- Cero pantallas que se recarguen o pierdan estado.
- Confirmaciones por vibración corta, no por múltiples pasos.
- Nunca confiar solo en el color: usar texto e iconos para sobrante/faltante.

### 6.2 Navegación

- **Barra superior:** nombre del negocio y botón **Caja** con indicador de sesión abierta o cerrada.
- **Barra inferior fija, cuatro destinos:**
  1. **Vender** — productos de tienda.
  2. **Cobrar** — servicios (luz, agua, recargas y otros).
  3. **Clientes** — cuentas y saldos.
  4. **Más** — historial, ajustes, respaldo y auditoría.
- El botón de cobrar de una venta es fijo en la parte inferior de la pantalla de venta, respetando `safe-area-inset-bottom`.
- El historial y los ajustes viven dentro de **Más** para no competir con las acciones diarias.

### 6.3 Pantallas

| Pantalla | Contenido principal |
|---|---|
| Desbloqueo | PIN grande, teclado, recuperación |
| Vender | Buscador, productos, botón de producto rápido, carrito inferior |
| Carrito | Líneas, cantidades, total, cliente, cobrar |
| Cobro | Total, Efectivo/QR/Mixto, calculadora, referencia, QR del negocio |
| Servicios | Cobro de luz, agua, recargas y otros; comisión y remesa |
| Clientes | Búsqueda, saldo, últimos movimientos |
| Detalle cliente | Saldo, depositar, retirar, transferir, historial |
| Caja | Sesión actual, esperado, gastos, retiro, cerrar |
| Cierre | Conteo, QR, resumen, diferencia, confirmación |
| Historial | Pestañas Ventas / Caja / Cuentas, solo lectura |
| Catálogo | Productos, servicios, stock, disponible |
| Auditoría | Acciones sensibles, detalle antes/después |
| Respaldo | Estado, respaldar ahora, restaurar, passphrase |
| Calculadora | Utilidad flotante con historial, disponible en cualquier pantalla |
| Ajustes | Negocio, QR de cobro, denominaciones, PIN, preferencias |

### 6.4 Flujo de venta

1. Tocar `Vender`.
2. Buscar producto o tocar una tarjeta del catálogo.
3. Si el producto no existe, tocar `+`, escribir nombre y precio; se guarda en el catálogo y entra al carrito.
4. Ajustar cantidad en el carrito si hace falta.
5. Tocar `Cobrar`.
6. Elegir método.
7. Si es efectivo, abrir la calculadora; si es QR, mostrar la imagen cargada e ingresar la referencia; si es mixto, repartir.
8. Confirmar. La app guarda la venta, los pagos, la caja y la auditoría en una transacción.
9. Mostrar confirmación breve con folio, total, método y cambio; limpiar el carrito.
10. Si la app se cerró antes de confirmar, ofrecer recuperar el borrador.

### 6.5 Calculadora de cambio

- Pantalla completa.
- Total a pagar visible.
- Monto recibido editable con keypad propio.
- Cambio en tipografía gigante.
- Billetes rápidos: 20, 50, 100, 200 (configurables).
- Botón `Exacto`.
- Botón `Borrar`.
- Si falta dinero: mostrar `FALTAN Bs X` en ámbar, no solo rojo.
- Si el cambio se puede entregar con una combinación de denominaciones, mostrar sugerencia: `2 × 20 + 1 × 10`.
- Confirmar con el botón inferior; no se cierra por accidente.

### 6.6 Pago QR y mixto

- Imagen del QR del negocio cargada desde la galería en Ajustes; se muestra grande al cobrar por QR.
- La imagen se reduce a máximo 1200 px de lado y se guarda como JPEG de calidad 0.88.
- Referencia obligatoria si hay QR.
- Campo con teclado alfanumérico o numérico según el caso.
- En mixto, al editar efectivo se completa el resto en QR y viceversa.
- Indicador `Asignado / Falta` siempre visible.
- No permitir guardar si la suma no coincide.
- La foto del comprobante de pago queda para una fase posterior.

### 6.7 Conteo de cierre

- Filas grandes por denominación: valor, cantidad, subtotal.
- Teclado numérico o botones `+`/`−`.
- Total de conteo fijo en la parte inferior.
- Luego, total QR informado.
- Resumen final con esperado, contado y diferencia.
- Si hay diferencia, pedir nota; si está configurado, pedir PIN de autorización.
- Compartir resumen por WhatsApp.

### 6.8 Comportamiento móvil

- **Borrador persistente:** carrito, cliente y método en `checkoutDrafts`.
- **Android back:** cierra la hoja/pantalla actual antes de salir; si hay datos, confirmar.
- **Wake Lock:** mantener pantalla encendida durante el cobro cuando esté disponible.
- **Auto-lock:** al volver de segundo plano después de 2–5 minutos, pedir PIN.
- **Sin conexión:** la app sigue funcionando; el indicador de respaldo muestra pendiente.
- **Actualización PWA:** preguntar antes de recargar; nunca en medio de una venta.
- **Evitar zoom accidental:** inputs con `font-size >= 16px`; `touch-action: manipulation`.
- **Safe areas:** usar `viewport-fit=cover` y `env(safe-area-inset-*)`.

### 6.9 Atajos opcionales

Siguen existiendo para teclado Bluetooth o lector de códigos, pero no son el camino principal:

| Tecla | Acción |
|---|---|
| `F1` | Buscar cliente |
| `F2` | Buscar producto/servicio |
| `F3` | Calculadora de cambio |
| `Enter` | Confirmar paso / guardar |
| `Esc` | Cerrar / limpiar |
| `Tab` | Cambiar método en modo simple |
| `Alt+1/2/3` | Efectivo / QR / Mixto |

Un lector de códigos que se comporte como teclado puede capturar el código y agregar el producto; se implementará como mejora opcional.

---

## 7. Arquitectura

### 7.1 Vista general

```text
Celular Android
┌────────────────────────────────────────────────┐
│ PWA React instalada                            │
│                                                │
│  Pantallas táctiles                            │
│        │                                       │
│  Servicios de dominio                          │
│  (ventas, caja, cuentas, catálogo, auditoría)  │
│        │                                       │
│  Dexie / IndexedDB                             │
│  ├─ operaciones y libros                       │
│  ├─ fotos de comprobantes                      │
│  └─ borradores                                 │
└──────────────────────┬─────────────────────────┘
                       │ solo cuando hay internet
                       ▼
              Supabase (respaldo)
              ├─ Auth
              ├─ Storage privado
              └─ manifiesto de copias cifradas
```

### 7.2 Principios técnicos

- La UI nunca espera a la red para guardar una operación.
- Toda operación crítica es una transacción de Dexie.
- La lógica de negocio vive en `domain/`, no en los componentes.
- El respaldo lee la base local; no interviene en las ventas.
- Las fotos se guardan como Blob comprimido y se referencian por ID.
- Los reportes se generan desde los libros y snapshots, no desde el catálogo actual.
- El catálogo se congela en las líneas de venta (nombre, precio, comisión, proveedor).

### 7.3 PWA

- `manifest.webmanifest`: nombre, iconos, `display: standalone`, orientación retrato, colores.
- Service worker con precache del shell y actualización controlada.
- Hosting estático HTTPS (Cloudflare Pages, Netlify o Vercel).
- `navigator.storage.persist()` al completar el onboarding.
- La primera instalación requiere internet; después funciona offline.
- No se cachean respuestas de Supabase ni datos sensibles en el service worker.
- Los datos viven en IndexedDB, no en el service worker.

### 7.4 Alternativa futura

Si más adelante se necesita un APK, impresión nativa o almacenamiento más resistente, la UI puede envolverse con Capacitor. No es parte de la v1 y no debe condicionar el diseño actual.

---

## 8. Modelo de datos

### 8.1 Convenciones

- Tablas y campos en inglés.
- IDs ULID generados en el teléfono.
- Fechas ISO 8601 UTC (`2026-11-16T14:30:00.000Z`); mostrar en hora de Bolivia.
- Booleanos indexables como `0 | 1`.
- Montos: `...Cents: number`, entero seguro.
- No se usan claves autoincrementales para entidades; sí para contadores locales.
- Los textos de catálogo se copian a la línea de venta como snapshot.

### 8.2 Tablas

| Tabla | Propósito |
|---|---|
| `settings` | Configuración clave-valor |
| `users` | PIN local y rol operativo |
| `clients` | Clientes y saldo cacheado |
| `accountMovements` | Libro de cuenta de cada cliente |
| `products` | Catálogo de tienda |
| `services` | Catálogo de servicios |
| `cashSessions` | Apertura, cierre y snapshots de caja |
| `cashDenominations` | Conteo por billete/moneda |
| `cashMovements` | Libro de efectivo/QR de la sesión |
| `sales` | Cabecera de venta |
| `saleItems` | Líneas de producto o servicio |
| `salePayments` | Pagos separados de la venta |
| `expenses` | Gastos, retiros de dueña y remesas |
| `serviceRemittances` | Remesas a empresas de servicios |
| `auditLogs` | Historial de acciones sensibles |
| `attachments` | Fotos de comprobantes |
| `checkoutDrafts` | Borrador de venta en curso |
| `counters` | Folios y secuencias |
| `backupState` | Estado del respaldo |

### 8.3 Campos principales

#### `clients`

- `id`, `name`, `searchName`, `phone?`, `alias?`, `notes?`
- `balanceCents` (caché)
- `active: 0 | 1`
- `createdAt`, `updatedAt`

#### `accountMovements`

- `id`, `clientId`
- `sessionId?`, `saleId?`
- `type`: `deposit | withdrawal | sale_payment | service_payment | adjustment | transfer_in | transfer_out | reversal`
- `amountCents` (firmado: + entra al cliente, − sale)
- `cashCents`, `qrCents` (firmados; suman `amountCents` salvo movimientos internos)
- `balanceAfterCents`
- `method`: `cash | qr | mixed | internal`
- `qrReference?`, `groupId?`, `description?`
- `idempotencyKey` único
- `createdBy`, `createdAt`
- `reversalOf?`, `reversedBy?`, `authorizedBy?`, `reason?`

#### `products`

- `id`, `name`, `searchName`, `priceCents`
- `controlStock: 0 | 1`, `stock`, `available: 0 | 1`
- `category?`, `sortOrder`, `active: 0 | 1`
- `createdAt`, `updatedAt`

#### `services`

- `id`, `name`, `providerName`, `searchName`
- `commissionFixedCents`, `commissionBps` (0–10000)
- `fixedAmountCents?`
- `requiresSupplyNumber: 0 | 1`
- `sortOrder`, `active: 0 | 1`
- `createdAt`, `updatedAt`

#### `cashSessions`

- `id`, `number`
- `status: 'open' | 'closed'`
- `openedBy`, `openedAt`
- `openingCashCents`, `openingQrCents`
- `openingNotes?`
- `closedBy?`, `closedAt?`
- `expectedCashCents?`, `countedCashCents?`, `differenceCashCents?`
- `expectedQrCents?`, `countedQrCents?`, `differenceQrCents?`
- `closingNotes?`, `reportZText?`, `authorizedBy?`

#### `cashDenominations`

- `id`, `sessionId`, `phase: 'opening' | 'closing'`
- `type: 'bill' | 'coin'`
- `valueCents`, `count`, `subtotalCents`

#### `cashMovements`

- `id`, `sessionId`
- `medium: 'cash' | 'qr'`
- `type`:
  - `sale`
  - `client_deposit`
  - `client_withdrawal`
  - `expense`
  - `owner_withdrawal`
  - `service_remittance`
  - `adjustment`
  - `reversal`
- `amountCents` (firmado)
- `saleId?`, `salePaymentId?`, `accountMovementId?`, `expenseId?`, `remittanceId?`
- `description?`, `idempotencyKey?`
- `createdBy`, `createdAt`
- `reversalOf?`, `reversedBy?`, `authorizedBy?`

#### `sales`

- `id`, `folio` único
- `sessionId`, `clientId?`
- `subtotalCents`, `discountCents`, `totalCents`
- `status: 'completed' | 'voided'`
- `notes?`
- `idempotencyKey` único
- `createdBy`, `createdAt`
- `voidedAt?`, `voidedBy?`, `voidReason?`, `authorizedBy?`

#### `saleItems`

- `id`, `saleId`
- `kind: 'product' | 'service'`
- `productId?`, `serviceId?`
- `description` (snapshot)
- `quantity`
- `unitPriceCents`, `discountCents`, `subtotalCents`
- `serviceAmountCents?` (monto que va a la empresa)
- `commissionCents?`
- `providerName?`, `supplyNumber?`
- `remittanceId?`, `remittedAt?`

#### `salePayments`

- `id`, `saleId`
- `method: 'cash' | 'qr' | 'account'`
- `amountCents`
- `cashReceivedCents?`, `changeCents?`
- `qrReference?`, `attachmentId?`, `clientId?`
- `createdAt`

#### `expenses`

- `id`, `sessionId`, `movementId`
- `kind: 'expense' | 'owner_withdrawal'`
- `category`, `description`, `amountCents`
- `medium: 'cash' | 'qr'`
- `attachmentId?`
- `createdBy`, `createdAt`
- `reversedBy?`, `authorizedBy?`

#### `serviceRemittances`

- `id`, `providerName`, `sessionId`, `movementId`
- `amountCents`
- `createdBy`, `createdAt`
- `notes?`

#### `auditLogs`

- `id`
- `actorId`, `authorizedBy?`
- `action`, `entity`, `entityId`, `sessionId?`
- `before?`, `after?` (JSON)
- `reason?`
- `deviceId`
- `createdAt`

#### `attachments`

- `id`, `ownerType`, `ownerId`
- `mimeType`, `width?`, `height?`, `size`
- `blob: Blob`
- `createdAt`

#### `settings` / `counters` / `backupState`

- `settings`: `key`, `value`, `updatedAt`.
- `counters`: `name` (`saleFolio`, `cashSessionNumber`), `value`.
- `backupState`: `key`, `value` (última copia, hash, pendiente, versión de esquema).

### 8.4 Esquema Dexie v1

```ts
import Dexie, { type Table } from 'dexie';

export type Id = string;
export type Cents = number;

export class MarielDB extends Dexie {
  clients!: Table<Client, Id>;
  accountMovements!: Table<AccountMovement, Id>;
  products!: Table<Product, Id>;
  services!: Table<Service, Id>;
  cashSessions!: Table<CashSession, Id>;
  cashMovements!: Table<CashMovement, Id>;
  cashDenominations!: Table<CashDenomination, Id>;
  sales!: Table<Sale, Id>;
  saleItems!: Table<SaleItem, Id>;
  salePayments!: Table<SalePayment, Id>;
  expenses!: Table<Expense, Id>;
  serviceRemittances!: Table<ServiceRemittance, Id>;
  auditLogs!: Table<AuditLog, Id>;
  attachments!: Table<Attachment, Id>;
  checkoutDrafts!: Table<CheckoutDraft, string>;
  counters!: Table<Counter, string>;
  backupState!: Table<BackupState, string>;

  constructor() {
    super('mariel');
    this.version(1).stores({
      clients: 'id, searchName, phone, active, updatedAt',
      accountMovements:
        'id, &idempotencyKey, clientId, [clientId+createdAt], sessionId, saleId, createdAt, type, reversalOf',
      products: 'id, searchName, active, available, updatedAt',
      services: 'id, searchName, active, updatedAt',
      cashSessions: 'id, status, openedAt, closedAt',
      cashMovements:
        'id, sessionId, [sessionId+medium], createdAt, type, saleId, salePaymentId, accountMovementId, expenseId, remittanceId, reversalOf',
      cashDenominations: 'id, sessionId, [sessionId+phase], valueCents',
      sales: 'id, &folio, &idempotencyKey, sessionId, clientId, createdAt, status',
      saleItems: 'id, saleId, [saleId+kind], productId, serviceId, remittanceId',
      salePayments: 'id, saleId, [saleId+method], method, qrReference, createdAt',
      expenses: 'id, sessionId, movementId, createdAt, kind',
      serviceRemittances: 'id, providerName, sessionId, createdAt',
      auditLogs: 'id, createdAt, entity, [entity+entityId], action, actorId',
      attachments: 'id, ownerType, ownerId, createdAt',
      checkoutDrafts: 'id, updatedAt',
      counters: 'name',
      backupState: 'key'
    });
  }
}

export const db = new MarielDB();
```

### 8.5 Invariantes

1. `sale.totalCents = Σ saleItems.subtotalCents − sale.discountCents`.
2. `sale.totalCents = Σ salePayments.amountCents`.
3. `accountMovement.amountCents = cashCents + qrCents` para movimientos con método cash/qr/mixed.
4. `client.balanceCents = Σ accountMovements.amountCents` (excluyendo reversos dobles; el reverso compensa al original).
5. `cashSession.expectedCashCents = openingCashCents + Σ cashMovements(medium=cash).amountCents`.
6. `cashSession.expectedQrCents = openingQrCents + Σ cashMovements(medium=qr).amountCents`.
7. No puede existir más de una sesión con `status = 'open'`.
8. Un pago con método `account` exige `clientId` y saldo suficiente.
9. Un pago QR exige `qrReference.length >= 4`.
10. Los movimientos con `reversalOf` no se pueden reversar dos veces.
11. Los totales de una sesión cerrada no se recalculan ni se modifican.

---

## 9. Reglas de dinero y caja

### 9.1 Efectos de cada operación

| Operación | Saldo cliente | Efectivo | QR | Resultado del negocio |
|---|---:|---:|---:|---|
| Venta en efectivo | — | +total | — | Ingreso por venta |
| Venta QR | — | — | +total | Ingreso por venta |
| Venta con saldo de cliente | −total | — | — | Ingreso por venta |
| Depósito de cliente en efectivo | +monto | +monto | — | Pasivo con el cliente |
| Depósito de cliente QR | +monto | — | +monto | Pasivo con el cliente |
| Retiro de cliente en efectivo | −monto | −monto | — | Pasivo con el cliente |
| Retiro de cliente QR | −monto | — | −monto | Pasivo con el cliente |
| Transferencia entre clientes | −A / +B | — | — | Sin efecto |
| Gasto menor | — | −monto | — | Gasto |
| Retiro de la dueña | — | −monto | — | Retiro de capital |
| Cobro de servicio | — | +total | — | Ingreso = comisión; pasivo = monto empresa |
| Remesa a prestataria | — | −monto | — | Baja pasivo de servicio |
| Anulación | reverso | reverso | reverso | Reversión completa |

La comisión de un servicio no se reconoce como efectivo extra: ya está incluida en el total cobrado. El negocio retiene la comisión y debe remitir el resto.

### 9.2 Fórmulas de cierre

```text
Efectivo esperado = fondo inicial efectivo + Σ movimientos_caja efectivo
QR esperado       = fondo inicial QR + Σ movimientos_caja QR

Diferencia efectivo = contado efectivo − esperado efectivo
Diferencia QR       = contado QR − esperado QR

Total diferencia = diferencia efectivo + diferencia QR
```

- Diferencia > 0: sobrante.
- Diferencia < 0: faltante.
- Se guarda el snapshot del reporte Z al cerrar para que no cambie con el tiempo.

### 9.3 Anulaciones

- No se borra una venta.
- Se marca `status = 'voided'` con motivo, usuario y autorización.
- Se crean movimientos de caja inversos por cada pago.
- Se revierte el movimiento de cuenta si se pagó con saldo.
- Se repone el stock si correspondía.
- Se registra auditoría antes/después.
- Si la venta pertenece a una sesión cerrada, el reverso de caja se registra en la sesión abierta actual como ajuste post-cierre, con vínculo a la venta original.

### 9.4 Redondeo

- Comisiones porcentuales: `Math.round(serviceAmountCents * bps / 10000)`.
- No se usan porcentajes con decimales flotantes.
- Descuentos futuros: siempre en centavos enteros.
- El cambio se calcula como `cashReceivedCents − cashAppliedCents`.

---

## 10. Respaldo y restauración

### 10.1 Proveedor

Supabase, exclusivamente para:

- autenticación de la dueña;
- bucket privado de respaldos;
- tabla de manifiesto de copias.

Datos concretos del proyecto:

- Project ref: `lmktjrvmfvirsactdwqe`
- URL: `https://lmktjrvmfvirsactdwqe.supabase.co`
- Bucket: `mariel-backups` (privado, 50 MB por archivo)
- Tabla: `public.backup_manifests` con RLS
- Migración: `20261116222406_backup_infrastructure`

No se usa para consultas operativas ni para sincronización entre dispositivos en la v1.

### 10.2 Contenido de una copia

- `manifest.json`: versión de esquema, versión de app, fecha, deviceId, conteos, hash.
- `data.json`: tablas exportadas.
- `attachments/`: fotos comprimidas (solo en copia completa).
- Todo se comprime con gzip y se cifra antes de subir.

### 10.3 Cifrado

- Passphrase de respaldo distinta del PIN de la app.
- Derivación con PBKDF2-SHA-256, sal aleatoria, iteraciones altas (mínimo 310.000).
- Cifrado AES-GCM 256 con IV aleatorio.
- El sobre incluye versión, sal, IV, iteraciones y ciphertext.
- La passphrase nunca se envía a Supabase.
- Si se pierde la passphrase, la copia no se puede descifrar. La app debe advertirlo y ofrecer una clave de recuperación.

### 10.4 Disparadores

- Al cerrar caja (obligatorio).
- Cada 2 horas si hay cambios y hay internet.
- Manual desde `Más → Respaldo`.
- Copia completa con fotos: diaria o al cerrar el día.
- Copia rápida sin fotos: las intermedias.

### 10.5 Retención

- Últimas 14 copias rápidas.
- Últimas 7 copias completas.
- Borrado automático de las más antiguas.
- La nube no reemplaza una exportación manual ocasional.

### 10.6 Restauración

1. Instalar la PWA en el teléfono nuevo.
2. Iniciar sesión en Supabase.
3. Elegir la copia más reciente.
4. Introducir la passphrase.
5. Validar versión y hash.
6. Confirmar reemplazo de la base local.
7. Verificar saldos, última sesión y conteos.
8. Registrar auditoría de restauración.

### 10.7 Fallos esperados

- Sin internet: el respaldo queda pendiente; la venta continúa.
- Passphrase incorrecta: no se descifra; no se borra nada.
- Copia corrupta: validar hash y ofrecer otra copia.
- Versión de esquema incompatible: migrar o pedir actualización.
- Storage lleno: alertar y permitir limpiar copias antiguas.

### 10.8 Estado de implementación

A fecha 2026-11-16:

- [x] Proyecto Supabase creado.
- [x] MCP de OpenCode conectado y autenticado.
- [x] Bucket privado `mariel-backups` creado.
- [x] Tabla `backup_manifests` creada con RLS.
- [x] Políticas de Storage por `user_id`.
- [x] Migración remota aplicada.
- [x] Asesores de seguridad sin hallazgos.
- [ ] Cuenta de la dueña creada.
- [ ] Registro público desactivado.
- [ ] Integración de subida/descarga desde la PWA.
- [ ] Prueba de restauración completa.

---

## 11. Seguridad y auditoría

- PIN de app de 6 dígitos, hash con sal y derivación lenta; nunca en texto plano.
- Bloqueo automático al volver de segundo plano después de 2–5 minutos.
- Re-autenticación para acciones sensibles.
- Límite de intentos y registro de fallos.
- No se guardan secretos de Supabase en el repositorio.
- RLS en Supabase: cada usuario solo accede a sus copias.
- Las fotos de comprobantes pueden contener datos bancarios; se guardan localmente y en copias cifradas.
- IndexedDB no está cifrado en reposo por la app; depende del cifrado del dispositivo. No prometer cifrado local.
- La auditoría local no es a prueba de manipulación. Para separación de funciones real se necesita servidor o dispositivo supervisor.
- El PIN de autorización es una barrera operativa, no una firma criptográfica.
- Los reportes compartidos por WhatsApp salen del control de la app; avisar antes de compartir datos sensibles.

---

## 12. Stack y estructura

### 12.1 Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS 4
- Dexie 4 + `dexie-react-hooks`
- React Router 7
- Zod
- ULID
- `fflate`
- Web Crypto API
- Supabase JS
- `vite-plugin-pwa` 2 (manifest, service worker e instalación)
- Vitest 5 + Playwright
- Node 22+ (el equipo usa Node 26)
- npm workspaces

### 12.1.1 Estado del scaffold (2026-11-17)

Implementado en `apps/web`:

- Vite 8, React 19, TypeScript 5.9, Tailwind 4.
- PWA con manifest, iconos generados sin dependencias y precache del shell.
- Esquema Dexie v2 con 20 tablas.
- `MoneyKeypad`, `ChangeCalculator`, `PaymentSheet`.
- Calculadora rápida con historial local.
- Navegación real: Caja en la barra superior; Vender / Cobrar / Clientes / Más abajo.
- Apertura de caja con efectivo inicial y totales esperados desde el libro de caja.
- Catálogo persistente con producto rápido y búsqueda normalizada.
- Venta transaccional con folio, pagos, movimientos de caja y auditoría.
- Imagen del QR de cobro en Ajustes, mostrada al cobrar por QR.
- Historial unificado de ventas, caja y cuentas.
- 76 pruebas unitarias y de base local con Vitest y `fake-indexeddb`.

Todavía no implementado:

- Cierre y arqueo de caja con conteo físico.
- Cuentas de clientes.
- Cobro real de servicios y remesas.
- Respaldo y restauración desde la app.
- Inicio de sesión y PIN.

### 12.2 Estructura

```text
sistema-mariel/
├─ apps/
│  └─ web/
│     ├─ public/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ components/
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ checkout/
│     │  │  ├─ clients/
│     │  │  ├─ cash/
│     │  │  ├─ catalog/
│     │  │  ├─ reports/
│     │  │  ├─ backup/
│     │  │  └─ audit/
│     │  ├─ db/
│     │  ├─ domain/
│     │  └─ lib/
│     └─ ...
├─ docs/
├─ AGENTS.md
└─ README.md
```

### 12.3 Capas

- `components/`: UI sin reglas de negocio.
- `features/`: pantallas y hooks de cada módulo.
- `domain/`: funciones puras y servicios transaccionales.
- `db/`: esquema, repositorios y migraciones.
- `lib/`: dinero, fechas, criptografía, share, IDs.

### 12.4 Convenciones

- No poner lógica de saldos en componentes.
- No hacer varias transacciones para una misma venta.
- No usar `Date.now()` directo en lógica de negocio; inyectar reloj cuando facilite pruebas.
- No usar `parseFloat` para montos.
- No usar `any` sin justificación.
- Errores de negocio con mensajes claros en español.

---

## 13. Plan de implementación

### Fase 0 — Base (completada)

- Scaffold React/Vite/TypeScript/Tailwind/PWA.
- Tokens visuales, shell móvil, navegación inferior, safe areas.
- Dexie v1, migraciones, seed de denominaciones y settings.
- Vitest configurado.

### Fase 1 — Cobro rápido (completada)

- `MoneyKeypad`.
- `ChangeCalculator`.
- `PaymentSheet` con efectivo, QR y mixto.
- Validaciones y pruebas unitarias.
- Demo navegable con carrito de prueba.

### Fase 2 — Venta y caja mínima (implementada salvo borrador persistente)

- Apertura de sesión.
- Catálogo simple, producto rápido y carrito real.
- Servicio de venta transaccional.
- Pagos, movimientos de caja y auditoría.
- Folio secuencial.
- Confirmación de la venta.
- Pendiente: idempotencia de reintentos y borrador persistente del carrito.

### Fase 3 — Cierre y reportes (siguiente)

- Gastos, retiros y remesas.
- Conteo por denominaciones.
- Cierre X/Z, diferencias y snapshot.
- Resumen compartible por WhatsApp.
- Correcciones post-cierre.

### Fase 4 — Clientes

- Alta y búsqueda.
- Depósitos, retiros, transferencias.
- Pago de venta con saldo.
- Historial y saldo.
- Ajustes con auditoría.

### Fase 5 — Servicios

- Catálogo de servicios.
- Comisión fija/porcentual.
- Suministro y empresa.
- Servicios pendientes de remisión.
- Remesas.

### Fase 6 — Respaldo

- Cuenta Supabase.
- Passphrase y clave de recuperación.
- Snapshot, gzip, cifrado.
- Subida, retención y restauración.
- Onboarding y estado de respaldo.

### Fase 7 — Auditoría y endurecimiento

- Pantalla de auditoría.
- Bloqueo automático y PIN.
- Ajustes.
- Pruebas E2E.
- Prueba de instalación, modo avión, cierre y restauración en otro teléfono.

### Fase 8 — Opcional

- Escaneo de códigos.
- Capacitor/APK si se justifica.
- Mejoras de reportes.
- Exportación CSV.

---

## 14. Pruebas y aceptación

### Unitarias

- Parseo y formato de Bs.
- Cambio exacto y faltante.
- Desglose de cambio por denominaciones.
- Totales de venta.
- Comisión de servicio.
- Saldo de cliente.
- Efectivo/QR esperado.
- Cifrado/descifrado de respaldo.
- Normalización de búsqueda.

### Integración con Dexie

- Venta con un pago.
- Venta mixta con dos pagos.
- Venta con saldo de cliente.
- Reintento con misma idempotencyKey.
- Retiro con saldo insuficiente.
- Anulación y reverso.
- Cierre con diferencia.
- Corrección post-cierre.
- Solo una sesión abierta.

### E2E móvil

- Instalar PWA.
- Abrir caja.
- Vender en efectivo con cambio.
- Vender QR con referencia.
- Vender mixto.
- Depositar a cliente.
- Cerrar caja.
- Compartir resumen.
- Activar modo avión y seguir vendiendo.
- Cerrar la app a mitad del cobro y recuperar.
- Respaldar y restaurar en otro contexto.

### Criterios de aceptación

- No hay montos flotantes.
- No se puede guardar una venta descuadrada.
- No se pierde una venta por cerrar la app.
- El cierre no modifica sesiones anteriores.
- El reporte Z coincide con los libros.
- La restauración deja la base operable y verificable.

---

## 15. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| IndexedDB borrado por el sistema | `storage.persist()`, respaldo frecuente y exportación manual |
| Pérdida del teléfono | Restauración cifrada en un teléfono nuevo |
| Pérdida de passphrase | Clave de recuperación y advertencia explícita |
| Error de dinero por decimales | Centavos enteros y pruebas |
| Venta a medias por fallo | Transacción Dexie única |
| Doble cobro por doble toque | Botón bloqueado, idempotencia y confirmación |
| Cambio a otra app pierde el carrito | Borrador persistente en cada cambio |
| Android back cierra la app | Manejo de historial y confirmación |
| Respaldo no se ejecuta en segundo plano | Respaldo al abrir/cerrar y estado visible |
| Auditoría local manipulable | Documentar límite; servidor si se requiere |
| Confusión entre efectivo propio y de servicios | Remesas y vista de pendientes |
| Storage de Supabase lleno | Compresión, retención y copias sin fotos |
| Scope creep (impresión, multiusuario) | Documento de alcance y decisiones bloqueadas |

---

## 16. Decisiones pendientes

Estas no bloquean el inicio, pero deben resolverse antes de la fase indicada:

- Formato exacto del PIN de autorización y su política de intentos (fase 7).
- Política de comisión editable manualmente o solo calculada (fase 5).
- Si se permite saldo negativo y bajo qué autorización (fase 4).
- Retención de fotos de comprobantes en la nube (fase 6).
- Clave de recuperación: palabras, código o archivo (fase 6).
- Umbral de diferencia de caja que exige PIN (fase 3).
- Nombre y datos que aparecerán en el resumen compartido (fase 3).
- Email definitivo de la cuenta de respaldo y política de recuperación (fase 6).
- Momento para desactivar el registro público de Supabase (fase 6).

---

## 17. Glosario

- **Cliente:** persona cuyo dinero administra el negocio.
- **Cuenta:** saldo y libro de movimientos de un cliente.
- **Movimiento de cuenta:** entrada o salida del saldo del cliente.
- **Venta:** operación de tienda o servicio cobrada al cliente.
- **Línea de venta:** producto o servicio dentro de una venta.
- **Pago:** parte del total de una venta, con un método.
- **Mixto:** dos pagos, uno en efectivo y otro por QR.
- **Sesión de caja:** período entre apertura y cierre.
- **Movimiento de caja:** entrada o salida de efectivo o QR.
- **Arqueo:** conteo físico y comparación con lo esperado.
- **Cierre X:** resumen parcial sin cerrar.
- **Cierre Z:** cierre definitivo y congelado.
- **Remesa:** pago que el negocio hace a una empresa de servicios por lo cobrado.
- **Comisión:** ingreso del negocio por cobrar un servicio.
- **Passthrough / monto servicio:** dinero cobrado que pertenece a la empresa, no al negocio.
- **Borrador:** venta en curso guardada para no perderla.
- **ULID:** identificador único generado localmente.

---

## Control de cambios

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-11-16 | Documento inicial; arquitectura móvil local-first, sin tickets, con respaldo cifrado |
| 1.1 | 2026-11-16 | Infraestructura Supabase de respaldo creada y verificada; integración pendiente |
| 1.2 | 2026-11-17 | Scaffold PWA, esquema Dexie v2, componentes de cobro y calculadora con historial |
| 1.3 | 2026-11-17 | Navegación real, venta transaccional, apertura de caja, catálogo con producto rápido, QR de cobro e historial |
