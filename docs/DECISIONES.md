# Registro de decisiones — Sistema Mariel

Formato: cada decisión es un ADR corto. No se reescribe la historia; si una decisión cambia, se agrega una nueva entrada que reemplaza a la anterior.

---

## ADR-001 — PWA local-first en lugar de servidor en PC

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el uso principal será un celular Android, no una PC. Un servidor local por Wi-Fi obligaría a que el teléfono y la PC estén encendidos y conectados para poder vender.

**Decisión:** construir una PWA con React que guarde todo en Dexie/IndexedDB dentro del teléfono. El hosting solo entrega el shell de la aplicación.

**Consecuencias:**
- La operación funciona sin internet y sin PC.
- El teléfono es la fuente de verdad.
- El respaldo pasa a ser crítico.
- No hay sincronización multi-dispositivo en la v1.

---

## ADR-002 — Un solo dispositivo operativo en la v1

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el sistema es unipersonal. Agregar sincronización entre dispositivos introduce conflictos de saldos, sesiones y numeración.

**Decisión:** un único celular activo. Se puede restaurar en otro teléfono, pero no operar dos a la vez.

**Consecuencias:**
- No hay backend operativo ni resolución de conflictos.
- La restauración reemplaza la base local.
- Si en el futuro se necesita tablet + celular, se deberá diseñar sincronización con un ADR nuevo.

---

## ADR-003 — Dexie/IndexedDB como base local

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** se evaluaron SQLite nativo con Capacitor, SQLite WASM y Dexie.

**Decisión:** Dexie por su madurez en navegadores móviles, transacciones entre tablas, integración con React y ausencia de build nativo.

**Consecuencias:**
- No hay SQL; los reportes se calculan en TypeScript.
- Se debe solicitar almacenamiento persistente y respaldar con frecuencia.
- Si el volumen o la necesidad de durabilidad crecen, se puede evaluar Capacitor + SQLite.

---

## ADR-004 — Supabase solo para respaldo cifrado

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** se necesita respaldo automático sin convertir la nube en dependencia operativa.

**Decisión:** Supabase Auth + Storage privado + manifiesto de copias. El snapshot se comprime y se cifra en el teléfono antes de subir.

**Consecuencias:**
- La app sigue vendiendo sin internet.
- Se necesita una cuenta y una passphrase de respaldo.
- Supabase nunca ve los datos en claro.
- Los límites del plan gratuito obligan a comprimir y retener pocas copias.

---

## ADR-005 — Sin tickets ni impresora térmica

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el usuario confirmó que el sistema es para control interno y no emite tickets.

**Decisión:** eliminar impresión, ESC/POS, Bluetooth y formato 58 mm del alcance.

**Consecuencias:**
- No hay comprobante para el cliente.
- Los cierres y resúmenes se ven en pantalla y se comparten como texto por WhatsApp.
- Se elimina una dependencia importante y se simplifica la app móvil.

---

## ADR-006 — Dinero en centavos enteros y moneda BOB

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** los errores de coma flotante son inaceptables en caja y cuentas.

**Decisión:** todos los montos se guardan como `number` entero de centavos. Formato y parseo con `Intl.NumberFormat('es-BO', { currency: 'BOB' })`.

**Consecuencias:**
- Se necesitan utilidades de dinero y pruebas.
- Las comisiones porcentuales se redondean a centavos con `Math.round`.
- Nunca se usa `parseFloat` para interpretar montos.

---

## ADR-007 — Pagos separados y mixto como dos pagos

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** un pago mixto no es un método único; es efectivo más QR. Guardarlo en columnas ambiguas impide auditar cada parte.

**Decisión:** tabla `salePayments` con una fila por método. Mixto = una fila de efectivo y una de QR. La suma debe ser igual al total.

**Consecuencias:**
- Validación transaccional de la suma.
- El cambio se calcula solo sobre la parte en efectivo.
- Cada pago genera su movimiento de caja correspondiente.

---

## ADR-008 — Libro de caja y libro de cuenta separados

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** reconstruir el efectivo esperado desde ventas, gastos y cuentas es propenso a errores.

**Decisión:** `cashMovements` es el libro de efectivo/QR; `accountMovements` es el libro de cada cliente. Los saldos cacheados se actualizan en la misma transacción.

**Consecuencias:**
- El cierre se calcula sumando el libro de caja.
- Se puede reconciliar el saldo del cliente contra sus movimientos.
- Toda operación debe registrar ambos libros cuando corresponda.

---

## ADR-009 — Nada se borra; sesiones cerradas inmutables

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el historial es parte central del sistema.

**Decisión:** anulaciones con reverso, desactivación de catálogo, auditoría de acciones y sesiones cerradas que no se editan.

**Consecuencias:**
- Las correcciones post-cierre se registran en la sesión actual como ajuste.
- Los reportes históricos no cambian.
- Se necesita una UI clara para reversos y ajustes.

---

## ADR-010 — Auditoría y PIN adaptados a modo unipersonal

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** no existe una separación real de funciones si la misma dueña opera y autoriza.

**Decisión:** PIN de app y re-autenticación para acciones sensibles. PIN de supervisor opcional si otra persona usa el sistema. No simular controles empresariales.

**Consecuencias:**
- El PIN evita errores y deja rastro, no impide manipulación técnica.
- La auditoría es operativa y local.
- Si se requiere separación real, se necesita servidor o dispositivo supervisor.

---

## ADR-011 — UI en español, código y esquema en inglés

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Decisión:** nombres de tablas, campos, tipos y funciones en inglés; textos visibles, mensajes y documentación en español.

**Consecuencias:**
- Consistencia técnica.
- El glosario del proyecto traduce los términos de negocio.

---

## ADR-012 — Teclado numérico propio; atajos opcionales

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el uso principal es táctil con una mano; los atajos de teclado del requerimiento original no aplican como camino principal.

**Decisión:** keypad propio para montos y acciones grandes. Los atajos se mantienen para teclado Bluetooth o lector de códigos.

**Consecuencias:**
- Más trabajo de UI, pero menos errores de tecleo.
- El keypad debe reutilizarse en cobro, cambio, depósitos, retiros y cierre.

---

## ADR-013 — Reportes por Web Share, sin envío automático de WhatsApp

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** enviar WhatsApp automáticamente requiere API, servidor y credenciales; además la usuaria debe controlar qué comparte.

**Decisión:** generar texto formateado y abrir la hoja nativa de compartir. Alternativa: copiar al portapapeles.

**Consecuencias:**
- No hay envío en segundo plano.
- El reporte se puede compartir con cualquier app.
- No se almacenan credenciales de WhatsApp.

---

## ADR-014 — Passphrase de respaldo y clave de recuperación

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el respaldo debe ser privado incluso si la cuenta de Supabase se compromete.

**Decisión:** cifrado AES-GCM en el teléfono con clave derivada por PBKDF2 de una passphrase. Se ofrece una clave de recuperación para guardar.

**Consecuencias:**
- Si se pierden passphrase y clave, no hay recuperación.
- La app debe explicar el riesgo y verificar la passphrase.
- Supabase solo almacena blobs cifrados.

---

## ADR-015 — Sin backend operativo en la v1

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** un backend operativo agregaría latencia, costo y complejidad offline.

**Decisión:** toda la operación vive en el teléfono. No hay API de ventas, caja ni clientes en la v1.

**Consecuencias:**
- No hay consulta remota en tiempo real.
- El respaldo y la restauración cubren la continuidad.
- Cualquier dashboard remoto futuro será un proyecto aparte.

---

## ADR-016 — Comisión de servicios como ingreso y passthrough como pasivo

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** el dinero cobrado por luz/agua no pertenece al negocio; solo la comisión.

**Decisión:** cada línea de servicio registra monto para la empresa y comisión. Se agrega una vista de servicios pendientes y remesas.

**Consecuencias:**
- El cierre incluye todo el efectivo cobrado, pero el reporte separa lo que se debe remitir.
- Se necesita registrar remesas para bajar el pasivo.
- No confundir el total cobrado con ganancia.

---

## ADR-017 — Hosting estático HTTPS para la PWA

**Fecha:** 2026-11-16  
**Estado:** aceptada

**Contexto:** la PWA debe instalarse en el teléfono, actualizarse y funcionar offline sin depender de una PC.

**Decisión:** publicar el shell en un hosting estático con HTTPS (Cloudflare Pages, Netlify o Vercel). Los datos no se suben al hosting.

**Consecuencias:**
- La primera instalación requiere internet.
- No se deben incluir secretos en el bundle; solo la clave pública de Supabase con RLS.
- El service worker cachea el shell, no los respaldos.

---

## ADR-018 — Calculadora rápida con historial local

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** la operadora necesita hacer cuentas sueltas en cualquier momento (precios, descuentos, vueltos, consultas de clientes) sin salir de la app ni abrir la calculadora del sistema, que pierde el contexto y no guarda historial.

**Decisión:**
- Calculadora general disponible en todas las pantallas mediante una pestaña lateral discreta en el borde derecho.
- No se usa un botón flotante en la esquina inferior porque taparía el botón de cobrar o los productos.
- Evaluación en orden de tecleo, sin precedencia, como una calculadora de mostrador.
- Historial de los últimos 50 resultados confirmados con `=`, guardado en la tabla local `calculatorEntries`.
- El historial se puede recuperar con un toque y borrar en dos pasos.
- La calculadora **no** registra dinero, no toca caja y no reemplaza la calculadora de cambio del cobro.

**Consecuencias:**
- Se agregó la versión 2 del esquema Dexie.
- El historial entra en el respaldo cifrado como una tabla más.
- Los cálculos usan coma flotante de JavaScript redondeada para mostrar; no son aptos para persistir montos.
- Si la operadora no la usa, la pestaña permanece discreta y no interfiere con el flujo de venta.

---

## ADR-019 — Navegación con Caja arriba y cuatro destinos abajo

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** la operadora necesita abrir y consultar la caja en cualquier momento, pero también vender, cobrar servicios y entrar a las cuentas de clientes con una sola mano. La propuesta anterior mezclaba Caja en la barra inferior y dejaba servicios escondido dentro de Vender.

**Decisión:**
- **Caja** vive en la barra superior, con un punto que indica si la sesión está abierta o cerrada.
- La barra inferior tiene cuatro destinos: **Vender / Cobrar / Clientes / Más**.
- **Vender** es la tienda de productos.
- **Cobrar** es para servicios externos (luz, agua, recargas y otros).
- **Clientes** es para cuentas y saldos.
- **Más** reúne historial, ajustes, respaldo y auditoría.

**Consecuencias:**
- La caja queda siempre a un toque sin ocupar un lugar en la barra inferior.
- Servicios tiene entrada propia y no se confunde con la venta de productos.
- El historial y los ajustes no compiten con las acciones diarias.
- Cuando se implemente el cobro real de servicios, la pantalla ya tiene su lugar.

---

## ADR-020 — Venta guardada en una sola transacción Dexie

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** una venta toca varias tablas (venta, líneas, pagos, caja, contador de folio y auditoría). Si una parte falla, el dinero y la caja quedarían inconsistentes.

**Decisión:**
- `createSale()` escribe venta, líneas, pagos, movimientos de caja, contador de folio y auditoría dentro de una única transacción de Dexie.
- La suma de los pagos debe ser exactamente el total; si no coincide, no se guarda nada.
- El efectivo registra en caja el monto aplicado, no el monto recibido; el vuelto queda en el pago.
- El folio es `YYYY-NNNN`, con año local de Bolivia y contador propio.
- Una venta exige una sesión de caja abierta.
- Cada movimiento de caja enlaza la venta y el pago que lo originó.
- La venta y su auditoría son inmutables; una corrección futura será un reverso, no un borrado.

**Consecuencias:**
- Un fallo a mitad de la venta no deja registros huérfanos.
- La caja se puede reconstruir desde su libro de movimientos.
- El contador de folio avanza solo cuando la venta se confirma.
- La idempotencia de reintentos y el borrador persistente quedan pendientes para la fase de cierre.

---

## ADR-021 — Producto rápido persistente y agregado al carrito

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** en el mostrador aparecen productos que todavía no están en el catálogo. Obligar a salir de la venta, crear el producto y volver agrega pasos y errores.

**Decisión:**
- El botón `+` junto al buscador abre una hoja con nombre y precio.
- Al guardar, el producto se crea en el catálogo y se agrega de inmediato al carrito actual.
- El nombre se normaliza para búsqueda y no se permite duplicar un producto activo.
- El precio debe ser un entero positivo en centavos.

**Consecuencias:**
- La venta no se interrumpe y el producto queda disponible para la próxima vez.
- El catálogo puede crecer desde el uso real, sin una pantalla de administración previa.
- Si el nombre o el precio son inválidos, no se crea nada y se muestra el motivo.

---

## ADR-022 — Imagen del QR de cobro guardada en el teléfono

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** la operadora ya tiene el QR de su negocio como imagen. Al cobrar por QR, el cliente necesita verlo grande y nítido; escribir un alias o un número no siempre alcanza.

**Decisión:**
- La imagen se carga desde la galería en **Más → Ajustes → QR de cobro**.
- Se aceptan PNG, JPG y WebP de hasta 5 MB.
- Antes de guardar se reduce a máximo 1200 px de lado y se convierte a JPEG de calidad 0.88, con fondo blanco.
- Se guarda como adjunto local con identificador fijo `business-qr`; no se sube a ningún servicio.
- Al elegir QR o mixto en el cobro, la imagen se muestra y se puede ampliar.
- Reemplazarla o quitarla es configuración, no un registro de ventas; la imagen entrará en el respaldo cifrado.

**Consecuencias:**
- El cobro por QR no depende de otra app ni de volver a buscar la imagen.
- El respaldo crecerá unos kilobytes por la imagen comprimida.
- Si no hay imagen cargada, el cobro por QR sigue disponible y se muestra un aviso para cargarla.

---

## ADR-023 — Historial unificado y de solo lectura

**Fecha:** 2026-11-17  
**Estado:** aceptada

**Contexto:** las ventas, los movimientos de caja y los movimientos de cuentas estaban en lugares distintos. La operadora necesita revisar qué pasó sin navegar por varias pantallas.

**Decisión:**
- El historial vive en **Más → Historial**.
- Tiene tres pestañas: **Ventas**, **Caja** y **Cuentas**.
- Muestra primero lo más reciente.
- Ventas muestra folio, total, método de pago y cantidad de artículos.
- Caja muestra tipo, medio, monto y fecha.
- Cuentas muestra cliente, tipo de movimiento, monto y fecha.
- Es de solo lectura: no se edita ni se borra desde ahí.

**Consecuencias:**
- Un solo lugar para revisar la operación diaria.
- Las correcciones se harán con reversos y auditoría, no desde el historial.
- Los reportes X/Z y el compartir por WhatsApp quedan para la fase de cierre.
