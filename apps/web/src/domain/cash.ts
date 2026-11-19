import {
  LOCAL_OWNER_ID,
  db,
  readSetting,
  type CashDenomination,
  type CashDenominationType,
  type CashMovement,
  type CashMovementMedium,
  type CashSession,
  type Cents,
  type Expense,
  type ExpenseKind,
  type MarielDB
} from '../db/db';
import { boliviaYear, nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { BOB_DENOMINATIONS, isValidAmount } from '../lib/money';
import { formatCashReportText, getSessionReportData } from './reports';

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

/** Tipo de denominación boliviana según su valor en centavos. */
export function denominationType(valueCents: number): CashDenominationType {
  return valueCents >= 1000 ? 'bill' : 'coin';
}

/** Suma el total en centavos de un conteo por denominaciones. */
export function sumDenominations(counts: Record<number, number>): Cents {
  let total = 0;
  for (const valueCents of BOB_DENOMINATIONS) {
    const count = counts[valueCents] ?? 0;
    if (!Number.isInteger(count) || count < 0) {
      throw new CashError('La cantidad de billetes o monedas no es válida.');
    }
    total += valueCents * count;
  }
  return total;
}

export type RecordCashExpenseInput = {
  kind: ExpenseKind;
  medium: CashMovementMedium;
  amountCents: Cents;
  category?: string;
  description: string;
};

/** Registra un gasto o retiro de la dueña en la sesión de caja abierta. */
export async function recordCashExpense(
  input: RecordCashExpenseInput,
  database: MarielDB = db
): Promise<Expense> {
  if (!isValidAmount(input.amountCents) || input.amountCents <= 0) {
    throw new CashError('El monto del egreso debe ser mayor a Bs 0,00.');
  }

  const description = input.description.trim();
  if (!description) {
    throw new CashError('Escribe una descripción para el movimiento.');
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';

  return database.transaction(
    'rw',
    database.cashSessions,
    database.cashMovements,
    database.expenses,
    database.auditLogs,
    async () => {
      const session = await database.cashSessions.where('status').equals('open').first();
      if (!session) {
        throw new CashError('No hay una caja abierta.');
      }

      const createdAt = nowIso();
      const expenseId = newId();
      const movementId = newId();
      const category = input.category?.trim() || (input.kind === 'owner_withdrawal' ? 'Retiro' : 'General');

      const movement: CashMovement = {
        id: movementId,
        sessionId: session.id,
        medium: input.medium,
        type: input.kind,
        amountCents: -input.amountCents,
        expenseId,
        description,
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      const expense: Expense = {
        id: expenseId,
        sessionId: session.id,
        movementId,
        kind: input.kind,
        category,
        description,
        amountCents: input.amountCents,
        medium: input.medium,
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      await database.cashMovements.add(movement);
      await database.expenses.add(expense);
      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: input.kind === 'owner_withdrawal' ? 'cash.owner_withdrawal' : 'cash.expense',
        entity: 'expense',
        entityId: expenseId,
        sessionId: session.id,
        after: {
          kind: input.kind,
          medium: input.medium,
          amountCents: input.amountCents,
          description
        },
        deviceId,
        createdAt
      });

      return expense;
    }
  );
}

export type CloseCashSessionInput = {
  sessionId: string;
  countedCashCents: Cents;
  countedQrCents: Cents;
  denominationCounts?: Record<number, number>;
  closingNotes?: string;
};

/**
 * Cierra la sesión de caja con conteo físico, cálculo de diferencias y reporte Z congelado.
 * Una vez cerrada, la sesión queda inmutable.
 */
export async function closeCashSession(
  input: CloseCashSessionInput,
  database: MarielDB = db
): Promise<CashSession> {
  if (!isValidAmount(input.countedCashCents)) {
    throw new CashError('El efectivo contado no es válido.');
  }
  if (!isValidAmount(input.countedQrCents)) {
    throw new CashError('El monto contado por QR no es válido.');
  }

  if (input.denominationCounts) {
    const sum = sumDenominations(input.denominationCounts);
    if (sum !== input.countedCashCents) {
      throw new CashError('El detalle de billetes y monedas no coincide con el total contado.');
    }
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';

  return database.transaction(
    'rw',
    [
      database.cashSessions,
      database.cashDenominations,
      database.cashMovements,
      database.sales,
      database.settings,
      database.auditLogs
    ],
    async () => {
      const session = await database.cashSessions.get(input.sessionId);
      if (!session) {
        throw new CashError('La sesión de caja no existe.');
      }
      if (session.status === 'closed') {
        throw new CashError('Esta sesión de caja ya está cerrada.');
      }

      const closedAt = nowIso();
      const reportData = await getSessionReportData(
        { ...session, closedAt },
        database
      );

      const expectedCashCents = reportData.expectedCashCents;
      const expectedQrCents = reportData.expectedQrCents;
      const differenceCashCents = input.countedCashCents - expectedCashCents;
      const differenceQrCents = input.countedQrCents - expectedQrCents;
      const closingNotes = input.closingNotes?.trim() || undefined;

      const reportZText = formatCashReportText(reportData, {
        kind: 'Z',
        closedAt,
        countedCashCents: input.countedCashCents,
        countedQrCents: input.countedQrCents,
        closingNotes
      });

      if (input.denominationCounts) {
        const rows: CashDenomination[] = [];
        for (const valueCents of BOB_DENOMINATIONS) {
          const count = input.denominationCounts[valueCents] ?? 0;
          if (count > 0) {
            rows.push({
              id: newId(),
              sessionId: session.id,
              phase: 'closing',
              type: denominationType(valueCents),
              valueCents,
              count,
              subtotalCents: valueCents * count
            });
          }
        }
        if (rows.length > 0) {
          await database.cashDenominations.bulkAdd(rows);
        }
      }

      const closedSession: CashSession = {
        ...session,
        status: 'closed',
        closedBy: LOCAL_OWNER_ID,
        closedAt,
        expectedCashCents,
        countedCashCents: input.countedCashCents,
        differenceCashCents,
        expectedQrCents,
        countedQrCents: input.countedQrCents,
        differenceQrCents,
        closingNotes,
        reportZText
      };

      await database.cashSessions.put(closedSession);

      const hasDifference = differenceCashCents !== 0 || differenceQrCents !== 0;
      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: hasDifference ? 'cash.close_with_difference' : 'cash.close',
        entity: 'cashSession',
        entityId: session.id,
        sessionId: session.id,
        before: { status: 'open' },
        after: {
          status: 'closed',
          expectedCashCents,
          countedCashCents: input.countedCashCents,
          differenceCashCents,
          expectedQrCents,
          countedQrCents: input.countedQrCents,
          differenceQrCents
        },
        reason: closingNotes,
        deviceId,
        createdAt: closedAt
      });

      return closedSession;
    }
  );
}

/** Lista las sesiones de caja cerradas, de la más reciente a la más antigua. */
export async function listClosedCashSessions(
  limit = 20,
  database: MarielDB = db
): Promise<CashSession[]> {
  const closed = await database.cashSessions
    .where('status')
    .equals('closed')
    .toArray();

  return closed
    .sort((a, b) => (b.closedAt ?? b.openedAt).localeCompare(a.closedAt ?? a.openedAt))
    .slice(0, limit);
}
