import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase, type Product } from '../db/db';
import { createProduct } from './catalog';
import { getSessionTotals, openCashSession } from './cash';
import { SaleError, countRecentQrReferences, createSale } from './sales';

describe('ventas', () => {
  let database: MarielDB;
  let product: Product;
  let sequence = 0;

  beforeEach(async () => {
    sequence += 1;
    database = new MarielDB(`mariel-sales-test-${sequence}`);
    await initializeDatabase(database);
    await openCashSession({ openingCashCents: 10_000 }, database);
    product = await createProduct({ name: 'Pan de queso', priceCents: 300 }, database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('guarda una venta en efectivo con cambio en una sola transacción', async () => {
    const result = await createSale(
      {
        items: [{ productId: product.id, quantity: 2 }],
        payments: [
          {
            method: 'cash',
            amountCents: 600,
            cashReceivedCents: 1000,
            changeCents: 400
          }
        ]
      },
      database
    );

    expect(result.sale.totalCents).toBe(600);
    expect(result.sale.folio).toMatch(/^\d{4}-0001$/);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.description).toBe('Pan de queso');
    expect(result.items[0]?.quantity).toBe(2);
    expect(result.payments[0]?.amountCents).toBe(600);
    expect(result.payments[0]?.cashReceivedCents).toBe(1000);
    expect(result.payments[0]?.changeCents).toBe(400);

    const movements = await database.cashMovements.toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.medium).toBe('cash');
    expect(movements[0]?.amountCents).toBe(600);
    expect(movements[0]?.type).toBe('sale');

    const session = await database.cashSessions.toCollection().first();
    const totals = await getSessionTotals(session!, database);
    expect(totals.expectedCashCents).toBe(10_600);
    expect(totals.salesCount).toBe(1);
  });

  it('guarda un pago QR con su referencia', async () => {
    const result = await createSale(
      {
        items: [{ productId: product.id, quantity: 1 }],
        payments: [
          {
            method: 'qr',
            amountCents: 300,
            qrReference: ' abcd1234 '
          }
        ]
      },
      database
    );

    expect(result.payments[0]?.method).toBe('qr');
    expect(result.payments[0]?.qrReference).toBe('ABCD1234');

    const movements = await database.cashMovements.toArray();
    expect(movements[0]?.medium).toBe('qr');
    expect(movements[0]?.amountCents).toBe(300);

    expect(await countRecentQrReferences('ABCD 1234', 24, database)).toBe(0);
    expect(await countRecentQrReferences('abcd1234', 24, database)).toBe(1);
  });

  it('guarda un pago mixto como dos pagos y dos movimientos', async () => {
    const result = await createSale(
      {
        items: [{ productId: product.id, quantity: 2 }],
        payments: [
          {
            method: 'cash',
            amountCents: 300,
            cashReceivedCents: 300,
            changeCents: 0
          },
          {
            method: 'qr',
            amountCents: 300,
            qrReference: 'QR-9988'
          }
        ]
      },
      database
    );

    expect(result.payments).toHaveLength(2);
    expect(result.payments.map((payment) => payment.method)).toEqual(['cash', 'qr']);

    const movements = await database.cashMovements.toArray();
    expect(movements).toHaveLength(2);
    expect(movements.reduce((sum, movement) => sum + movement.amountCents, 0)).toBe(600);
  });

  it('suma cantidades repetidas del mismo producto', async () => {
    const result = await createSale(
      {
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 2 }
        ],
        payments: [
          {
            method: 'cash',
            amountCents: 900,
            cashReceivedCents: 900,
            changeCents: 0
          }
        ]
      },
      database
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.quantity).toBe(3);
    expect(result.items[0]?.subtotalCents).toBe(900);
  });

  it('rechaza cantidades combinadas que superan el límite', async () => {
    await expect(
      createSale(
        {
          items: [
            { productId: product.id, quantity: 600 },
            { productId: product.id, quantity: 600 }
          ],
          payments: [
            {
              method: 'cash',
              amountCents: 600 * 1200,
              cashReceivedCents: 600 * 1200,
              changeCents: 0
            }
          ]
        },
        database
      )
    ).rejects.toThrow('999');
  });

  it('rechaza la venta si los pagos no suman el total y no deja rastros', async () => {
    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 2 }],
          payments: [
            {
              method: 'cash',
              amountCents: 500,
              cashReceivedCents: 500,
              changeCents: 0
            }
          ]
        },
        database
      )
    ).rejects.toBeInstanceOf(SaleError);

    expect(await database.sales.count()).toBe(0);
    expect(await database.saleItems.count()).toBe(0);
    expect(await database.cashMovements.count()).toBe(0);
  });

  it('rechaza el cobro si no hay caja abierta', async () => {
    await database.cashSessions.clear();

    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 1 }],
          payments: [
            {
              method: 'cash',
              amountCents: 300,
              cashReceivedCents: 300,
              changeCents: 0
            }
          ]
        },
        database
      )
    ).rejects.toThrow('Abre la caja');
  });

  it('rechaza un producto inactivo', async () => {
    await database.products.update(product.id, { active: 0 });

    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 1 }],
          payments: [
            {
              method: 'cash',
              amountCents: 300,
              cashReceivedCents: 300,
              changeCents: 0
            }
          ]
        },
        database
      )
    ).rejects.toThrow('no está disponible');
  });

  it('rechaza efectivo recibido menor al monto del pago', async () => {
    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 1 }],
          payments: [
            {
              method: 'cash',
              amountCents: 300,
              cashReceivedCents: 200,
              changeCents: 0
            }
          ]
        },
        database
      )
    ).rejects.toThrow('efectivo recibido');
  });

  it('rechaza una referencia QR demasiado corta', async () => {
    await expect(
      createSale(
        {
          items: [{ productId: product.id, quantity: 1 }],
          payments: [{ method: 'qr', amountCents: 300, qrReference: '12' }]
        },
        database
      )
    ).rejects.toThrow('al menos 4');
  });
});
