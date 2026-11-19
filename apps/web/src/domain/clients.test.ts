import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase } from '../db/db';
import { getSessionTotals, openCashSession } from './cash';
import { createProduct } from './catalog';
import {
  ClientError,
  createClient,
  deactivateClient,
  listActiveClients,
  listClientMovements,
  recordClientCashOperation,
  updateClient
} from './clients';
import { SaleError, createSale } from './sales';

describe('cuentas de clientes', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(async () => {
    sequence += 1;
    database = new MarielDB(`mariel-clients-test-${sequence}`);
    await initializeDatabase(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('crea, actualiza, busca sin acentos y desactiva clientes', async () => {
    const client = await createClient(
      { name: 'María José Pérez', phone: '70012345', alias: 'Mari' },
      database
    );
    expect(client.balanceCents).toBe(0);
    expect(client.active).toBe(1);

    const updated = await updateClient(
      client.id,
      { name: 'María José Pérez', phone: '71111111', alias: 'Doña Mari' },
      database
    );
    expect(updated.phone).toBe('71111111');

    const byName = await listActiveClients('maria jose', database);
    expect(byName.map((c) => c.id)).toEqual([client.id]);

    const byAlias = await listActiveClients('dona mari', database);
    expect(byAlias.map((c) => c.id)).toEqual([client.id]);

    await deactivateClient(client.id, database);
    expect(await listActiveClients('', database)).toHaveLength(0);
  });

  it('registra depósito y retiro actualizando saldo y caja en una transacción', async () => {
    const session = await openCashSession({ openingCashCents: 10000 }, database);
    const client = await createClient({ name: 'Carlos Mamani' }, database);

    const deposit = await recordClientCashOperation(
      {
        clientId: client.id,
        type: 'deposit',
        medium: 'cash',
        amountCents: 5000,
        description: 'Adelanto semanal'
      },
      database
    );
    expect(deposit.balanceAfterCents).toBe(5000);

    let totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(15000);

    const withdrawal = await recordClientCashOperation(
      {
        clientId: client.id,
        type: 'withdrawal',
        medium: 'cash',
        amountCents: 2000
      },
      database
    );
    expect(withdrawal.balanceAfterCents).toBe(3000);

    totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(13000);

    const refreshed = await database.clients.get(client.id);
    expect(refreshed?.balanceCents).toBe(3000);

    const movements = await listClientMovements(client.id, 10, database);
    expect(movements).toHaveLength(2);
  });

  it('rechaza retiro mayor al saldo disponible', async () => {
    await openCashSession({ openingCashCents: 5000 }, database);
    const client = await createClient({ name: 'Ana Quispe' }, database);

    await expect(
      recordClientCashOperation(
        {
          clientId: client.id,
          type: 'withdrawal',
          medium: 'cash',
          amountCents: 1000
        },
        database
      )
    ).rejects.toBeInstanceOf(ClientError);
  });

  it('cobra una venta con saldo de cliente sin ingresar efectivo a caja', async () => {
    const session = await openCashSession({ openingCashCents: 10000 }, database);
    const client = await createClient({ name: 'Lucía Flores' }, database);
    const product = await createProduct({ name: 'Café', priceCents: 1500 }, database);

    await recordClientCashOperation(
      {
        clientId: client.id,
        type: 'deposit',
        medium: 'cash',
        amountCents: 4000
      },
      database
    );

    const created = await createSale(
      {
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ method: 'account', amountCents: 3000, clientId: client.id }]
      },
      database
    );

    expect(created.sale.clientId).toBe(client.id);
    const refreshed = await database.clients.get(client.id);
    expect(refreshed?.balanceCents).toBe(1000);

    // La caja tiene 10000 apertura + 4000 depósito = 14000; la venta con saldo no suma efectivo.
    const totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(14000);
    expect(totals.salesCents).toBe(3000);

    // Si intenta otra venta de 3000 con saldo de 1000, falla.
    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 2 }],
          payments: [{ method: 'account', amountCents: 3000, clientId: client.id }]
        },
        database
      )
    ).rejects.toBeInstanceOf(SaleError);
  });
});
