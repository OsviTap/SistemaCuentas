import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase } from '../db/db';
import { CashError, getOpenCashSession, getSessionTotals, openCashSession } from './cash';

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
});
