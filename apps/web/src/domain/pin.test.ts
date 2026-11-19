import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase } from '../db/db';
import { getSessionTotals, openCashSession } from './cash';
import { createProduct } from './catalog';
import { createClient, recordClientCashOperation } from './clients';
import {
  PinError,
  clearOwnerPin,
  isPinConfigured,
  setOwnerPin,
  verifyOwnerPin
} from './pin';
import { SaleError, createSale, voidSale } from './sales';

describe('seguridad PIN y anulaciones', () => {
  let database: MarielDB;
  let seq = 0;

  beforeEach(async () => {
    seq += 1;
    database = new MarielDB(`mariel-pin-void-test-${seq}`);
    await initializeDatabase(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('configura, verifica, cambia y quita el PIN local', async () => {
    expect(await isPinConfigured(database)).toBe(false);

    await expect(setOwnerPin('12', undefined, database)).rejects.toBeInstanceOf(PinError);
    await setOwnerPin('1234', undefined, database);

    expect(await isPinConfigured(database)).toBe(true);
    expect(await verifyOwnerPin('1234', database)).toBe(true);
    expect(await verifyOwnerPin('9999', database)).toBe(false);

    await expect(setOwnerPin('5678', '0000', database)).rejects.toBeInstanceOf(PinError);
    await setOwnerPin('5678', '1234', database);
    expect(await verifyOwnerPin('5678', database)).toBe(true);

    await clearOwnerPin('5678', database);
    expect(await isPinConfigured(database)).toBe(false);
  });

  it('anula una venta en efectivo y con saldo de cliente revirtiendo caja y cuenta', async () => {
    const session = await openCashSession({ openingCashCents: 10_000 }, database);
    const product = await createProduct({ name: 'Jugo', priceCents: 1000 }, database);
    const client = await createClient({ name: 'Luis Vega' }, database);

    await recordClientCashOperation(
      { clientId: client.id, type: 'deposit', medium: 'cash', amountCents: 3000 },
      database
    );

    const cashSale = await createSale(
      {
        items: [{ productId: product.id, quantity: 1 }],
        payments: [{ method: 'cash', amountCents: 1000, cashReceivedCents: 1000, changeCents: 0 }]
      },
      database
    );

    const accountSale = await createSale(
      {
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ method: 'account', amountCents: 2000, clientId: client.id }]
      },
      database
    );

    // Anular venta en efectivo
    const voidedCash = await voidSale(
      { saleId: cashSale.sale.id, reason: 'Cliente devolvió el producto' },
      database
    );
    expect(voidedCash.status).toBe('voided');

    // No se puede anular dos veces
    await expect(
      voidSale({ saleId: cashSale.sale.id, reason: 'Repetido' }, database)
    ).rejects.toBeInstanceOf(SaleError);

    // Anular venta con saldo
    await voidSale(
      { saleId: accountSale.sale.id, reason: 'Error de cobro' },
      database
    );

    // Caja: 10000 apertura + 3000 depósito + 1000 venta - 1000 reverso = 13000
    const totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(13_000);
    expect(totals.salesCount).toBe(0);

    // Cliente recupera sus 2000 → vuelve a 3000
    const refreshedClient = await database.clients.get(client.id);
    expect(refreshedClient?.balanceCents).toBe(3000);
  });
});
