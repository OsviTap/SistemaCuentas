import {
  LOCAL_OWNER_ID,
  db,
  readSetting,
  type CashMovement,
  type CashSession,
  type Cents,
  type MarielDB
} from '../db/db';
import { boliviaYear, nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { isValidAmount } from '../lib/money';

export class CashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CashError';
  }
}

export type OpenCashSessionInput = {
  openingCashCents: Cents;
  openingQrCents?: Cents;
  notes?: string;
};

/** Sesión abierta, o undefined si la caja está cerrada. */
export async function getOpenCashSession(
  database: MarielDB = db
): Promise<CashSession | undefined> {
  return database.cashSessions.where('status').equals('open').first();
}

/** Abre la caja. Solo puede existir una sesión abierta a la vez. */
export async function openCashSession(
  input: OpenCashSessionInput,
  database: MarielDB = db
): Promise<CashSession> {
  const openingQrCents = input.openingQrCents ?? 0;

  if (!isValidAmount(input.openingCashCents)) {
    throw new CashError('El efectivo inicial no es válido.');
  }
  if (!isValidAmount(openingQrCents)) {
    throw new CashError('El monto inicial por QR no es válido.');
  }

  const deviceId = await readSetting('deviceId', database);

  return database.transaction(
    'rw',
    database.cashSessions,
    database.counters,
    database.auditLogs,
    async () => {
      const open = await database.cashSessions.where('status').equals('open').first();
      if (open) {
        throw new CashError(`Ya hay una caja abierta (${open.number}).`);
      }

      const counter = await database.counters.get('cashSessionNumber');
      const next = (counter?.value ?? 0) + 1;
      await database.counters.put({ name: 'cashSessionNumber', value: next });

      const openedAt = nowIso();
      const session: CashSession = {
        id: newId(),
        number: `${boliviaYear()}-${String(next).padStart(4, '0')}`,
        status: 'open',
        openedBy: LOCAL_OWNER_ID,
        openedAt,
        openingCashCents: input.openingCashCents,
        openingQrCents,
        openingNotes: input.notes?.trim() || undefined,
        deviceId: deviceId || undefined
      };

      await database.cashSessions.add(session);
      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: 'cash.open',
        entity: 'cashSession',
        entityId: session.id,
        sessionId: session.id,
        after: {
          number: session.number,
          openingCashCents: session.openingCashCents,
          openingQrCents: session.openingQrCents
        },
        deviceId: deviceId || 'local',
        createdAt: openedAt
      });

      return session;
    }
  );
}

export type SessionTotals = {
  salesCount: number;
  salesCents: Cents;
  cashSalesCents: Cents;
  qrSalesCents: Cents;
  expectedCashCents: Cents;
  expectedQrCents: Cents;
};

/** Totales de una sesión calculados desde el libro de caja, no desde ventas. */
export async function getSessionTotals(
  session: Pick<CashSession, 'id' | 'openingCashCents' | 'openingQrCents'>,
  database: MarielDB = db
): Promise<SessionTotals> {
  const movements = await database.cashMovements
    .where('sessionId')
    .equals(session.id)
    .toArray();
  const sales = await database.sales.where('sessionId').equals(session.id).toArray();

  let cashCents = 0;
  let qrCents = 0;
  let cashSalesCents = 0;
  let qrSalesCents = 0;

  for (const movement of movements) {
    if (movement.medium === 'cash') {
      cashCents += movement.amountCents;
      if (movement.type === 'sale') cashSalesCents += movement.amountCents;
    } else {
      qrCents += movement.amountCents;
      if (movement.type === 'sale') qrSalesCents += movement.amountCents;
    }
  }

  const completed = sales.filter((sale) => sale.status === 'completed');

  return {
    salesCount: completed.length,
    salesCents: completed.reduce((sum, sale) => sum + sale.totalCents, 0),
    cashSalesCents,
    qrSalesCents,
    expectedCashCents: session.openingCashCents + cashCents,
    expectedQrCents: session.openingQrCents + qrCents
  };
}

/** Últimos movimientos de caja de una sesión, del más reciente al más antiguo. */
export async function listSessionMovements(
  sessionId: string,
  limit = 10,
  database: MarielDB = db
): Promise<CashMovement[]> {
  const rows = await database.cashMovements.where('sessionId').equals(sessionId).toArray();

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
