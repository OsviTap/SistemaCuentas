import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MarielDB,
  initializeDatabase,
  readSetting,
  type AccountMovement,
  type Sale
} from './db';

const TABLES = [
  'accountMovements',
  'attachments',
  'auditLogs',
  'backupState',
  'calculatorEntries',
  'cashDenominations',
  'cashMovements',
  'cashSessions',
  'checkoutDrafts',
  'clients',
  'counters',
  'expenses',
  'products',
  'saleItems',
  'salePayments',
  'sales',
  'serviceRemittances',
  'services',
  'settings',
  'users'
];

const NOW = '2026-11-16T12:00:00.000Z';

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    folio: '2026-0001',
    sessionId: 'session-1',
    subtotalCents: 1000,
    discountCents: 0,
    totalCents: 1000,
    status: 'completed',
    idempotencyKey: 'idem-1',
    createdBy: 'user-1',
    createdAt: NOW,
    ...overrides
  };
}

describe('esquema de la base local', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(() => {
    sequence += 1;
    database = new MarielDB(`mariel-test-${sequence}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('crea todas las tablas esperadas', async () => {
    await database.open();
    expect(database.tables.map((table) => table.name).sort()).toEqual(TABLES);
  });

  it('siembra configuración y contadores de forma idempotente', async () => {
    await initializeDatabase(database);
    await initializeDatabase(database);

    expect(await database.settings.count()).toBe(Object.keys(DEFAULT_SETTINGS).length);
    expect(await database.counters.count()).toBe(2);
    expect(await readSetting('allowNegativeBalance', database)).toBe(false);
    expect(await readSetting('currency', database)).toBe('BOB');
    expect((await database.counters.get('saleFolio'))?.value).toBe(0);
  });

  it('no permite dos ventas con el mismo folio', async () => {
    await database.sales.add(makeSale());

    await expect(
      database.sales.add(makeSale({ id: 'sale-2', idempotencyKey: 'idem-2' }))
    ).rejects.toThrow();
  });

  it('no permite repetir la idempotencyKey de una venta', async () => {
    await database.sales.add(makeSale());

    await expect(
      database.sales.add(makeSale({ id: 'sale-2', folio: '2026-0002' }))
    ).rejects.toThrow();
  });

  it('consulta movimientos por cliente y fecha con el índice compuesto', async () => {
    const movement: AccountMovement = {
      id: 'mov-1',
      clientId: 'client-1',
      type: 'deposit',
      amountCents: 5000,
      cashCents: 5000,
      qrCents: 0,
      balanceAfterCents: 5000,
      method: 'cash',
      idempotencyKey: 'mov-idem-1',
      createdBy: 'user-1',
      createdAt: NOW
    };

    await database.accountMovements.bulkAdd([
      movement,
      { ...movement, id: 'mov-2', clientId: 'client-2', idempotencyKey: 'mov-idem-2' }
    ]);

    const rows = await database.accountMovements
      .where('[clientId+createdAt]')
      .between(['client-1', Dexie.minKey], ['client-1', Dexie.maxKey])
      .toArray();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('mov-1');
  });

  it('guarda el saldo del cliente y lo lee por id', async () => {
    await database.clients.add({
      id: 'client-1',
      name: 'Ana Pérez',
      searchName: 'ana perez',
      balanceCents: 12_500,
      active: 1,
      createdAt: NOW,
      updatedAt: NOW
    });

    const client = await database.clients.get('client-1');
    expect(client?.balanceCents).toBe(12_500);
  });
});
