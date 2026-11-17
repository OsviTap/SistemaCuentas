import {
  db,
  type AccountMovement,
  type CashMovement,
  type MarielDB,
  type Sale,
  type SalePayment
} from '../../db/db';

export type SaleHistoryRow = {
  sale: Sale;
  payments: SalePayment[];
  itemCount: number;
};

export type AccountHistoryRow = {
  movement: AccountMovement;
  clientName: string;
};

/** Ventas recientes con sus pagos y cantidad de artículos. */
export async function listRecentSales(
  limit = 30,
  database: MarielDB = db
): Promise<SaleHistoryRow[]> {
  const sales = await database.sales.orderBy('createdAt').reverse().limit(limit).toArray();
  if (sales.length === 0) return [];

  const saleIds = sales.map((sale) => sale.id);
  const [payments, items] = await Promise.all([
    database.salePayments.where('saleId').anyOf(saleIds).toArray(),
    database.saleItems.where('saleId').anyOf(saleIds).toArray()
  ]);

  return sales.map((sale) => ({
    sale,
    payments: payments.filter((payment) => payment.saleId === sale.id),
    itemCount: items
      .filter((item) => item.saleId === sale.id)
      .reduce((sum, item) => sum + item.quantity, 0)
  }));
}

/** Movimientos de caja recientes, de todos los medios. */
export async function listRecentCashMovements(
  limit = 50,
  database: MarielDB = db
): Promise<CashMovement[]> {
  return database.cashMovements.orderBy('createdAt').reverse().limit(limit).toArray();
}

/** Movimientos de cuentas de clientes recientes, con el nombre del cliente. */
export async function listRecentAccountMovements(
  limit = 50,
  database: MarielDB = db
): Promise<AccountHistoryRow[]> {
  const movements = await database.accountMovements
    .orderBy('createdAt')
    .reverse()
    .limit(limit)
    .toArray();

  if (movements.length === 0) return [];

  const clientIds = [...new Set(movements.map((movement) => movement.clientId))];
  const clients = await database.clients.bulkGet(clientIds);
  const names = new Map(
    clients.flatMap((client) => (client ? [[client.id, client.name] as const] : []))
  );

  return movements.map((movement) => ({
    movement,
    clientName: names.get(movement.clientId) ?? 'Cliente'
  }));
}
