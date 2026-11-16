# Bitácora de avances — Sistema Mariel

Este archivo es el estado vivo del proyecto. Se actualiza al terminar cada sesión de trabajo.
No reemplaza al documento maestro ni al registro de decisiones.

## Estado general

| Fase | Estado |
|---|---|
| 0. Documentación y arquitectura | Completada |
| 1. Scaffold y shell móvil | Pendiente |
| 2. Cobro rápido (keypad, cambio, pagos) | Pendiente |
| 3. Venta y caja mínima | Pendiente |
| 4. Cierre y reportes | Pendiente |
| 5. Cuentas de clientes | Pendiente |
| 6. Servicios y remesas | Pendiente |
| 7. Respaldo cifrado | Pendiente |
| 8. Auditoría y endurecimiento | Pendiente |
| 9. Pruebas E2E e instalación | Pendiente |

## Próximo paso

Crear el scaffold de la PWA y el primer bloque funcional móvil:

1. `MoneyKeypad`
2. `ChangeCalculator`
3. `PaymentSheet` con efectivo, QR y mixto

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
