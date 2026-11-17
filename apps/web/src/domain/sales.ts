import {
  LOCAL_OWNER_ID,
  db,
  readSetting,
  type CashSession,
  type Cents,
  type MarielDB,
  type Product,
  type Sale,
  type SaleItem,
  type SalePayment
} from '../db/db';
import {
  normalizeQrReference,
  validateQrReference,
  type SalePaymentInput
} from '../features/checkout/payments';
import { boliviaYear, nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { MAX_AMOUNT_CENTS } from '../lib/money';

export class SaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaleError';
  }
}

export type SaleItemInput = {
  productId: string;
  quantity: number;
};

export type CreateSaleInput = {
  items: SaleItemInput[];
  payments: SalePaymentInput[];
  notes?: string;
};

export type CreatedSale = {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
};

function buildLines(
  inputs: SaleItemInput[],
  products: (Product | undefined)[]
): {
  lines: Array<{ product: Product; quantity: number; subtotalCents: Cents }>;
  totalCents: Cents;
} {
  const lines: Array<{ product: Product; quantity: number; subtotalCents: Cents }> = [];
  let totalCents = 0;

  inputs.forEach((input, index) => {
    const product = products[index];

    if (!product) {
      throw new SaleError('Uno de los productos ya no existe.');
    }
    if (product.active !== 1 || product.available !== 1) {
      throw new SaleError(`«${product.name}» no está disponible.`);
    }

    const subtotalCents = product.priceCents * input.quantity;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_AMOUNT_CENTS) {
      throw new SaleError('El total de la venta es demasiado grande.');
    }

    totalCents += subtotalCents;
    if (totalCents > MAX_AMOUNT_CENTS) {
      throw new SaleError('El total de la venta es demasiado grande.');
    }

    lines.push({ product, quantity: input.quantity, subtotalCents });
  });

  return { lines, totalCents };
}

function normalizePayments(
  payments: SalePaymentInput[],
  totalCents: Cents
): SalePaymentInput[] {
  if (payments.length === 0) {
    throw new SaleError('Registra al menos un pago.');
  }

  let sum = 0;
  const normalized: SalePaymentInput[] = [];

  for (const payment of payments) {
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) {
      throw new SaleError('Cada pago debe ser mayor que cero.');
    }

    sum += payment.amountCents;

    if (payment.method === 'cash') {
      if (
        !Number.isInteger(payment.cashReceivedCents) ||
        payment.cashReceivedCents < payment.amountCents
      ) {
        throw new SaleError('El efectivo recibido no alcanza para el pago.');
      }

      normalized.push({
        method: 'cash',
        amountCents: payment.amountCents,
        cashReceivedCents: payment.cashReceivedCents,
        changeCents: payment.cashReceivedCents - payment.amountCents
      });
      continue;
    }

    const referenceError = validateQrReference(payment.qrReference);
    if (referenceError) throw new SaleError(referenceError);

    normalized.push({
      method: 'qr',
      amountCents: payment.amountCents,
      qrReference: normalizeQrReference(payment.qrReference)
    });
  }

  if (sum !== totalCents) {
    throw new SaleError('La suma de los pagos debe ser exactamente el total.');
  }

  return normalized;
}

/**
 * Guarda la venta completa en una sola transacción de Dexie:
 * venta, líneas, pagos, movimientos de caja y auditoría.
 */
export async function createSale(
  input: CreateSaleInput,
  database: MarielDB = db
): Promise<CreatedSale> {
  if (input.items.length === 0) {
    throw new SaleError('Agrega al menos un producto.');
  }

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 999) {
      throw new SaleError('La cantidad debe ser un entero entre 1 y 999.');
    }
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  for (const quantity of quantities.values()) {
    if (quantity > 999) {
      throw new SaleError('La cantidad debe ser un entero entre 1 y 999.');
    }
  }

  const itemInputs = [...quantities.entries()].map(([productId, quantity]) => ({
    productId,
    quantity
  }));

  const productIds = itemInputs.map((item) => item.productId);
  const deviceId = await readSetting('deviceId', database);

  return database.transaction(
    'rw',
    [
      database.products,
      database.sales,
      database.saleItems,
      database.salePayments,
      database.cashSessions,
      database.cashMovements,
      database.counters,
      database.auditLogs
    ],
    async () => {
      const session: CashSession | undefined = await database.cashSessions
        .where('status')
        .equals('open')
        .first();

      if (!session) {
        throw new SaleError('Abre la caja antes de cobrar.');
      }

      const products = await database.products.bulkGet(productIds);
      const { lines, totalCents } = buildLines(itemInputs, products);
      const payments = normalizePayments(input.payments, totalCents);

      const counter = await database.counters.get('saleFolio');
      const next = (counter?.value ?? 0) + 1;
      await database.counters.put({ name: 'saleFolio', value: next });

      const createdAt = nowIso();
      const saleId = newId();
      const folio = `${boliviaYear()}-${String(next).padStart(4, '0')}`;

      const sale: Sale = {
        id: saleId,
        folio,
        sessionId: session.id,
        subtotalCents: totalCents,
        discountCents: 0,
        totalCents,
        status: 'completed',
        notes: input.notes?.trim() || undefined,
        idempotencyKey: newId(),
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      const itemRecords: SaleItem[] = lines.map((line) => ({
        id: newId(),
        saleId,
        kind: 'product',
        productId: line.product.id,
        description: line.product.name,
        quantity: line.quantity,
        unitPriceCents: line.product.priceCents,
        discountCents: 0,
        subtotalCents: line.subtotalCents
      }));

      const paymentRecords: SalePayment[] = payments.map((payment) => ({
        id: newId(),
        saleId,
        method: payment.method,
        amountCents: payment.amountCents,
        cashReceivedCents:
          payment.method === 'cash' ? payment.cashReceivedCents : undefined,
        changeCents: payment.method === 'cash' ? payment.changeCents : undefined,
        qrReference: payment.method === 'qr' ? payment.qrReference : undefined,
        createdAt
      }));

      await database.sales.add(sale);
      await database.saleItems.bulkAdd(itemRecords);
      await database.salePayments.bulkAdd(paymentRecords);

      await database.cashMovements.bulkAdd(
        paymentRecords.map((payment) => ({
          id: newId(),
          sessionId: session.id,
          medium: payment.method === 'cash' ? ('cash' as const) : ('qr' as const),
          type: 'sale' as const,
          amountCents: payment.amountCents,
          saleId,
          salePaymentId: payment.id,
          description: `Venta ${folio}`,
          idempotencyKey: `${saleId}:${payment.id}`,
          createdBy: LOCAL_OWNER_ID,
          createdAt
        }))
      );

      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: 'sale.create',
        entity: 'sale',
        entityId: saleId,
        sessionId: session.id,
        after: {
          folio,
          totalCents,
          items: itemRecords.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            subtotalCents: item.subtotalCents
          })),
          payments: paymentRecords.map((payment) => ({
            method: payment.method,
            amountCents: payment.amountCents,
            qrReference: payment.qrReference
          }))
        },
        deviceId: deviceId || 'local',
        createdAt
      });

      return { sale, items: itemRecords, payments: paymentRecords };
    }
  );
}

/** Cantidad de veces que una referencia QR se usó en las últimas horas. */
export async function countRecentQrReferences(
  reference: string,
  hours = 24,
  database: MarielDB = db
): Promise<number> {
  const normalized = normalizeQrReference(reference);
  if (normalized.length < 4) return 0;

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await database.salePayments.where('qrReference').equals(normalized).toArray();

  return rows.filter((row) => row.createdAt >= since).length;
}
