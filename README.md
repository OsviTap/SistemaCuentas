# Sistema Mariel

Sistema móvil de control de dinero, cuentas de clientes, tienda, servicios y caja diaria para una persona que atiende mostrador.

**Repositorio:** <https://github.com/OsviTap/SistemaCuentas>

- **Uso principal:** celular Android, PWA instalada.
- **Modo de operación:** unipersonal, local-first, sin dependencia de internet.
- **Moneda:** bolivianos (BOB).
- **Respaldo:** cifrado en la nube; infraestructura creada, integración desde la app pendiente.
- **Tickets:** no se imprimen; los resúmenes se comparten como texto.

## Documentación

| Archivo | Para qué sirve |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Contexto permanente y reglas para el agente |
| [`docs/PROYECTO.md`](./docs/PROYECTO.md) | Documento maestro: alcance, UX, datos, arquitectura |
| [`docs/DECISIONES.md`](./docs/DECISIONES.md) | Historial de decisiones y sus motivos |
| [`docs/AVANCES.md`](./docs/AVANCES.md) | Bitácora de progreso por sesión |
| [`docs/SUPABASE.md`](./docs/SUPABASE.md) | Proyecto, bucket y respaldo cifrado |

## Estado

La PWA vende de verdad y guarda todo en el teléfono:

- navegación **Vender / Cobrar / Clientes / Más**, con **Caja** en la barra superior;
- apertura de caja y totales esperados de efectivo y QR;
- catálogo persistente y producto rápido;
- venta en efectivo, QR o mixto en una sola transacción de Dexie;
- imagen del QR de cobro cargada desde la galería;
- historial de ventas, caja y cuentas.

Pendiente: cierre y arqueo de caja, cuentas de clientes, cobro real de servicios, respaldo desde la app e inicio de sesión/PIN.

```bash
npm install
npm run dev       # http://localhost:5173
npm test
npm run build
```

El detalle actualizado está en [`docs/AVANCES.md`](./docs/AVANCES.md).
