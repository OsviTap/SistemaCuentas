import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase, writeSetting } from '../db/db';
import {
  CashError,
  closeCashSession,
  getOpenCashSession,
  getSessionTotals,
  listClosedCashSessions,
  openCashSession,
  recordCashExpense,
  sumDenominations
} from './cash';
import { formatCashReportText, getSessionReportData } from './reports';

describe('caja', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(async () => {
    sequence += 1;
    database = new MarielDB(`mariel-cash-test-${sequence}`);
    await initializeDatabase(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('abre una sesión y la deja como la única abierta', async () => {
    const session = await openCashSession({ openingCashCents: 5000 }, database);

    expect(session.status).toBe('open');
    expect(session.openingCashCents).toBe(5000);
    expect(session.openingQrCents).toBe(0);
    expect(session.number).toMatch(/^\d{4}-0001$/);
    expect((await getOpenCashSession(database))?.id).toBe(session.id);
  });

  it('no permite abrir dos cajas a la vez', async () => {
    await openCashSession({ openingCashCents: 1000 }, database);

    await expect(
      openCashSession({ openingCashCents: 2000 }, database)
    ).rejects.toBeInstanceOf(CashError);
  });

  it('rechaza montos iniciales inválidos', async () => {
    await expect(
      openCashSession({ openingCashCents: -1 }, database)
    ).rejects.toBeInstanceOf(CashError);
    await expect(
      openCashSession({ openingCashCents: 1.5 }, database)
    ).rejects.toBeInstanceOf(CashError);
  });

  it('calcula el efectivo esperado desde el libro de caja', async () => {
    const session = await openCashSession({ openingCashCents: 5000 }, database);

    await database.cashMovements.bulkAdd([
      {
        id: 'm-1',
        sessionId: session.id,
        medium: 'cash',
        type: 'sale',
        amountCents: 1200,
        createdBy: 'local-owner',
        createdAt: '2026-11-17T12:00:00.000Z'
      },
      {
        id: 'm-2',
        sessionId: session.id,
        medium: 'qr',
        type: 'sale',
        amountCents: 800,
        createdBy: 'local-owner',
        createdAt: '2026-11-17T12:01:00.000Z'
      }
    ]);

    const totals = await getSessionTotals(session, database);
    expect(totals.cashSalesCents).toBe(1200);
    expect(totals.qrSalesCents).toBe(800);
    expect(totals.expectedCashCents).toBe(6200);
    expect(totals.expectedQrCents).toBe(800);
  });

  it('suma correctamente el conteo por denominaciones bolivianas', () => {
    const total = sumDenominations({
      20000: 1,
      5000: 2,
      500: 3,
      50: 2
    });
    expect(total).toBe(20000 + 10000 + 1500 + 100);
    expect(() => sumDenominations({ 1000: -1 })).toThrow(CashError);
  });

  it('registra un gasto en efectivo y descuenta del efectivo esperado', async () => {
    const session = await openCashSession({ openingCashCents: 10000 }, database);

    const expense = await recordCashExpense(
      {
        kind: 'expense',
        medium: 'cash',
        amountCents: 1500,
        description: 'Bolsas plásticas'
      },
      database
    );

    expect(expense.amountCents).toBe(1500);
    const totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(8500);
  });

  it('cierra la caja sin diferencia, guarda denominaciones y congela el reporte Z', async () => {
    await writeSetting('businessName', 'Tienda Mariel', database);
    const session = await openCashSession({ openingCashCents: 5000 }, database);

    await database.cashMovements.add({
      id: 'm-sale-1',
      sessionId: session.id,
      medium: 'cash',
      type: 'sale',
      amountCents: 2000,
      createdBy: 'local-owner',
      createdAt: '2026-11-17T13:00:00.000Z'
    });

    const closed = await closeCashSession(
      {
        sessionId: session.id,
        countedCashCents: 7000,
        countedQrCents: 0,
        denominationCounts: { 5000: 1, 2000: 1 }
      },
      database
    );

    expect(closed.status).toBe('closed');
    expect(closed.expectedCashCents).toBe(7000);
    expect(closed.countedCashCents).toBe(7000);
    expect(closed.differenceCashCents).toBe(0);
    expect(closed.reportZText).toContain('CIERRE Z (DEFINITIVO)');
    expect(closed.reportZText).toContain('Tienda Mariel');
    expect(closed.reportZText).toContain('Cuadrado');
    expect(await getOpenCashSession(database)).toBeUndefined();

    const denoms = await database.cashDenominations
      .where('[sessionId+phase]')
      .equals([session.id, 'closing'])
      .toArray();
    expect(denoms).toHaveLength(2);

    const audits = await database.auditLogs.where('sessionId').equals(session.id).toArray();
    expect(audits.some((log) => log.action === 'cash.close')).toBe(true);
  });

  it('cierra la caja con diferencia, registra auditoría específica e impide re-cierre', async () => {
    const session = await openCashSession({ openingCashCents: 5000 }, database);

    const closed = await closeCashSession(
      {
        sessionId: session.id,
        countedCashCents: 4500,
        countedQrCents: 500,
        closingNotes: 'Faltó cambio de 5 Bs, llegó 5 Bs extra por QR'
      },
      database
    );

    expect(closed.differenceCashCents).toBe(-500);
    expect(closed.differenceQrCents).toBe(500);
    expect(closed.reportZText).toContain('Faltante');
    expect(closed.reportZText).toContain('Sobrante');

    const audits = await database.auditLogs.where('sessionId').equals(session.id).toArray();
    expect(audits.some((log) => log.action === 'cash.close_with_difference')).toBe(true);

    await expect(
      closeCashSession(
        { sessionId: session.id, countedCashCents: 5000, countedQrCents: 0 },
        database
      )
    ).rejects.toBeInstanceOf(CashError);

    const closedList = await listClosedCashSessions(10, database);
    expect(closedList.map((s) => s.id)).toEqual([session.id]);
  });

  it('genera reporte X parcial sin cerrar la sesión', async () => {
    const session = await openCashSession({ openingCashCents: 3000 }, database);
    const data = await getSessionReportData(session, database);
    const text = formatCashReportText(data, {
      kind: 'X',
      generatedAt: '2026-11-17T15:00:00.000Z'
    });

    expect(text).toContain('REPORTE X (PARCIAL)');
    expect(text).toContain('Bs 30,00');
    expect((await getOpenCashSession(database))?.id).toBe(session.id);
  });
});
