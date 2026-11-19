import {
  LOCAL_OWNER_ID,
  db,
  readSetting,
  type AccountMovement,
  type CashMovement,
  type CashMovementMedium,
  type CashSession,
  type Cents,
  type MarielDB,
  type Sale,
  type SaleItem,
  type SalePayment,
  type Service,
  type ServiceRemittance
} from '../db/db';
import {
  normalizeQrReference,
  validateQrReference,
  type SalePaymentInput
} from '../features/checkout/payments';
import { boliviaYear, nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { MAX_AMOUNT_CENTS, isValidAmount } from '../lib/money';
import { normalizeSearchName } from '../lib/search';

export class ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

/**
 * Calcula la comisión y el total a cobrar al cliente.
 * Fórmula: commissionCents = fixed + round(amount * bps / 10000).
 */
export function calculateServiceCommission(
  serviceAmountCents: Cents,
  commissionFixedCents: Cents,
  commissionBps: number
): { commissionCents: Cents; totalCents: Cents } {
  if (!Number.isInteger(serviceAmountCents) || serviceAmountCents <= 0) {
    throw new ServiceError('El monto del servicio debe ser mayor a cero.');
  }
  if (!Number.isInteger(commissionFixedCents) || commissionFixedCents < 0) {
    throw new ServiceError('La comisión fija no es válida.');
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new ServiceError('El porcentaje de comisión debe estar entre 0 y 100%.');
  }

  const variableCents = Math.round((serviceAmountCents * commissionBps) / 10_000);
  const commissionCents = commissionFixedCents + variableCents;
  const totalCents = serviceAmountCents + commissionCents;

  if (!Number.isSafeInteger(totalCents) || totalCents > MAX_AMOUNT_CENTS) {
    throw new ServiceError('El total del servicio supera el límite permitido.');
  }

  return { commissionCents, totalCents };
}

export type CreateServiceInput = {
  name: string;
  providerName: string;
  commissionFixedCents?: Cents;
  commissionBps?: number;
  fixedAmountCents?: Cents;
  requiresSupplyNumber?: boolean;
};

/** Crea un servicio en el catálogo local. */
export async function createService(
  input: CreateServiceInput,
  database: MarielDB = db
): Promise<Service> {
  const name = input.name.trim();
  const providerName = input.providerName.trim();
  if (!name) throw new ServiceError('El nombre del servicio es obligatorio.');
  if (!providerName) throw new ServiceError('La empresa prestataria es obligatoria.');

  const searchName = normalizeSearchName(`${name} ${providerName}`);
  if (!searchName) throw new ServiceError('El nombre debe tener letras o números.');

  const commissionFixedCents = input.commissionFixedCents ?? 0;
  const commissionBps = input.commissionBps ?? 0;
  if (!isValidAmount(commissionFixedCents)) {
    throw new ServiceError('La comisión fija no es válida.');
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new ServiceError('El porcentaje de comisión debe estar entre 0 y 100%.');
  }
  if (
    input.fixedAmountCents !== undefined &&
    (!isValidAmount(input.fixedAmountCents) || input.fixedAmountCents <= 0)
  ) {
    throw new ServiceError('El monto fijo del servicio debe ser mayor a cero.');
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const timestamp = nowIso();
  const count = await database.services.count();

  const service: Service = {
    id: newId(),
    name,
    providerName,
    searchName,
    commissionFixedCents,
    commissionBps,
    fixedAmountCents: input.fixedAmountCents,
    requiresSupplyNumber: input.requiresSupplyNumber ? 1 : 0,
    sortOrder: count + 1,
    active: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await database.transaction('rw', [database.services, database.auditLogs], async () => {
    await database.services.add(service);
    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'service.create',
      entity: 'service',
      entityId: service.id,
      after: {
        name: service.name,
        providerName: service.providerName,
        commissionFixedCents: service.commissionFixedCents,
        commissionBps: service.commissionBps
      },
      deviceId,
      createdAt: timestamp
    });
  });

  return service;
}

/** Desactiva un servicio sin borrarlo físicamente. */
export async function deactivateService(
  serviceId: string,
  database: MarielDB = db
): Promise<void> {
  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const timestamp = nowIso();

  await database.transaction('rw', [database.services, database.auditLogs], async () => {
    const existing = await database.services.get(serviceId);
    if (!existing || existing.active === 0) return;

    await database.services.update(serviceId, { active: 0, updatedAt: timestamp });
    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'service.deactivate',
      entity: 'service',
      entityId: serviceId,
      before: { active: 1 },
      after: { active: 0 },
      deviceId,
      createdAt: timestamp
    });
  });
}

/** Lista los servicios activos ordenados, filtrados por nombre o empresa. */
export async function listActiveServices(
  query = '',
  database: MarielDB = db
): Promise<Service[]> {
  const all = await database.services.orderBy('sortOrder').toArray();
  const active = all.filter((service) => service.active === 1);
  const normalized = normalizeSearchName(query);
  if (!normalized) return active;

  return active.filter((service) => service.searchName.includes(normalized));
}

export type CollectServiceInput = {
  serviceId: string;
  serviceAmountCents: Cents;
  supplyNumber?: string;
  payments: SalePaymentInput[];
  clientId?: string;
  notes?: string;
};

function normalizeServicePayments(
  payments: SalePaymentInput[],
  totalCents: Cents
): SalePaymentInput[] {
  if (payments.length === 0) {
    throw new ServiceError('Registra al menos un pago.');
  }

  let sum = 0;
  const normalized: SalePaymentInput[] = [];

  for (const payment of payments) {
    if (!Number.isInteger(payment.amountCents) || payment.amountCents <= 0) {
      throw new ServiceError('Cada pago debe ser mayor que cero.');
    }
    sum += payment.amountCents;

    if (payment.method === 'cash') {
      if (
        !Number.isInteger(payment.cashReceivedCents) ||
        payment.cashReceivedCents < payment.amountCents
      ) {
        throw new ServiceError('El efectivo recibido no alcanza para el pago.');
      }
      normalized.push({
        method: 'cash',
        amountCents: payment.amountCents,
        cashReceivedCents: payment.cashReceivedCents,
        changeCents: payment.cashReceivedCents - payment.amountCents
      });
      continue;
    }

    if (payment.method === 'account') {
      if (!payment.clientId) {
        throw new ServiceError('Selecciona un cliente para el pago con saldo.');
      }
      normalized.push({
        method: 'account',
        amountCents: payment.amountCents,
        clientId: payment.clientId
      });
      continue;
    }

    const refError = validateQrReference(payment.qrReference);
    if (refError) throw new ServiceError(refError);

    normalized.push({
      method: 'qr',
      amountCents: payment.amountCents,
      qrReference: normalizeQrReference(payment.qrReference)
    });
  }

  if (sum !== totalCents) {
    throw new ServiceError('La suma de los pagos debe ser exactamente el total.');
  }

  return normalized;
}

/**
 * Cobra un servicio en una sola transacción de Dexie:
 * registra venta, línea de servicio (separando monto de empresa y comisión),
 * pagos, movimientos de caja/cuenta y auditoría.
 */
export async function collectService(
  input: CollectServiceInput,
  database: MarielDB = db
): Promise<{ sale: Sale; item: SaleItem; payments: SalePayment[] }> {
  const [deviceId, allowNegative] = await Promise.all([
    readSetting('deviceId', database),
    readSetting('allowNegativeBalance', database)
  ]);

  return database.transaction(
    'rw',
    [
      database.services,
      database.clients,
      database.accountMovements,
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
        throw new ServiceError('Abre la caja antes de cobrar un servicio.');
      }

      const service = await database.services.get(input.serviceId);
      if (!service || service.active !== 1) {
        throw new ServiceError('El servicio no existe o está inactivo.');
      }

      const supplyNumber = input.supplyNumber?.trim() || undefined;
      if (service.requiresSupplyNumber === 1 && !supplyNumber) {
        throw new ServiceError('Ingresa el número de suministro o cuenta.');
      }

      const { commissionCents, totalCents } = calculateServiceCommission(
        input.serviceAmountCents,
        service.commissionFixedCents,
        service.commissionBps
      );

      const payments = normalizeServicePayments(input.payments, totalCents);

      const counter = await database.counters.get('saleFolio');
      const next = (counter?.value ?? 0) + 1;
      await database.counters.put({ name: 'saleFolio', value: next });

      const createdAt = nowIso();
      const saleId = newId();
      const folio = `${boliviaYear()}-${String(next).padStart(4, '0')}`;
      const saleClientId =
        input.clientId ??
        payments.find((payment) => payment.method === 'account')?.clientId;

      const sale: Sale = {
        id: saleId,
        folio,
        sessionId: session.id,
        clientId: saleClientId,
        subtotalCents: totalCents,
        discountCents: 0,
        totalCents,
        status: 'completed',
        notes: input.notes?.trim() || undefined,
        idempotencyKey: newId(),
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      const item: SaleItem = {
        id: newId(),
        saleId,
        kind: 'service',
        serviceId: service.id,
        description: `${service.name} (${service.providerName})`,
        quantity: 1,
        unitPriceCents: totalCents,
        discountCents: 0,
        subtotalCents: totalCents,
        serviceAmountCents: input.serviceAmountCents,
        commissionCents,
        providerName: service.providerName,
        supplyNumber
      };

      const paymentRecords: SalePayment[] = payments.map((payment) => ({
        id: newId(),
        saleId,
        method: payment.method,
        amountCents: payment.amountCents,
        cashReceivedCents:
          payment.method === 'cash' ? payment.cashReceivedCents : undefined,
        changeCents: payment.method === 'cash' ? payment.changeCents : undefined,
        qrReference: payment.method === 'qr' ? payment.qrReference : undefined,
        clientId: payment.method === 'account' ? payment.clientId : undefined,
        createdAt
      }));

      await database.sales.add(sale);
      await database.saleItems.add(item);
      await database.salePayments.bulkAdd(paymentRecords);

      const cashMovementsToAdd: CashMovement[] = [];
      const accountMovementsToAdd: AccountMovement[] = [];

      for (const payment of paymentRecords) {
        if (payment.method === 'account') {
          const client = payment.clientId
            ? await database.clients.get(payment.clientId)
            : undefined;
          if (!client || client.active !== 1) {
            throw new ServiceError('El cliente seleccionado no existe o está inactivo.');
          }
          const nextBalance = client.balanceCents - payment.amountCents;
          if (!allowNegative && nextBalance < 0) {
            throw new ServiceError(
              `El saldo de ${client.name} no alcanza para cubrir el servicio.`
            );
          }

          await database.clients.update(client.id, {
            balanceCents: nextBalance,
            updatedAt: createdAt
          });

          accountMovementsToAdd.push({
            id: newId(),
            clientId: client.id,
            sessionId: session.id,
            saleId,
            type: 'service_payment',
            amountCents: -payment.amountCents,
            cashCents: 0,
            qrCents: 0,
            balanceAfterCents: nextBalance,
            method: 'internal',
            description: `Servicio ${service.name} (${folio})`,
            idempotencyKey: `${saleId}:${payment.id}`,
            createdBy: LOCAL_OWNER_ID,
            createdAt
          });
          continue;
        }

        cashMovementsToAdd.push({
          id: newId(),
          sessionId: session.id,
          medium: payment.method === 'cash' ? 'cash' : 'qr',
          type: 'sale',
          amountCents: payment.amountCents,
          saleId,
          salePaymentId: payment.id,
          description: `Servicio ${service.name} (${folio})`,
          idempotencyKey: `${saleId}:${payment.id}`,
          createdBy: LOCAL_OWNER_ID,
          createdAt
        });
      }

      if (cashMovementsToAdd.length > 0) {
        await database.cashMovements.bulkAdd(cashMovementsToAdd);
      }
      if (accountMovementsToAdd.length > 0) {
        await database.accountMovements.bulkAdd(accountMovementsToAdd);
      }

      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: 'service.collect',
        entity: 'sale',
        entityId: saleId,
        sessionId: session.id,
        after: {
          folio,
          serviceName: service.name,
          providerName: service.providerName,
          supplyNumber,
          serviceAmountCents: input.serviceAmountCents,
          commissionCents,
          totalCents
        },
        deviceId: deviceId || 'local',
        createdAt
      });

      return { sale, item, payments: paymentRecords };
    }
  );
}

export type PendingProviderRemittance = {
  providerName: string;
  totalServiceAmountCents: Cents;
  totalCommissionCents: Cents;
  itemCount: number;
  itemIds: string[];
};

/** Lista los servicios cobrados pendientes de remisión agrupados por empresa. */
export async function listPendingRemittancesByProvider(
  database: MarielDB = db
): Promise<PendingProviderRemittance[]> {
  const unremitted = await database.saleItems
    .filter(
      (item) =>
        item.kind === 'service' &&
        !item.remittanceId &&
        Boolean(item.providerName) &&
        (item.serviceAmountCents ?? 0) > 0
    )
    .toArray();
  if (unremitted.length === 0) return [];

  const saleIds = [...new Set(unremitted.map((item) => item.saleId))];
  const sales = await database.sales.bulkGet(saleIds);
  const completedSaleIds = new Set(
    sales
      .filter((sale): sale is Sale => Boolean(sale && sale.status === 'completed'))
      .map((sale) => sale.id)
  );

  const grouped = new Map<string, PendingProviderRemittance>();

  for (const item of unremitted) {
    if (!completedSaleIds.has(item.saleId) || !item.providerName) continue;

    const current = grouped.get(item.providerName) ?? {
      providerName: item.providerName,
      totalServiceAmountCents: 0,
      totalCommissionCents: 0,
      itemCount: 0,
      itemIds: []
    };

    current.totalServiceAmountCents += item.serviceAmountCents ?? 0;
    current.totalCommissionCents += item.commissionCents ?? 0;
    current.itemCount += 1;
    current.itemIds.push(item.id);
    grouped.set(item.providerName, current);
  }

  return [...grouped.values()].sort((a, b) =>
    a.providerName.localeCompare(b.providerName, 'es')
  );
}

/** Registra una remesa a una empresa prestataria y marca sus servicios como remitidos. */
export async function remitProviderServices(
  input: {
    providerName: string;
    medium: CashMovementMedium;
    notes?: string;
  },
  database: MarielDB = db
): Promise<ServiceRemittance> {
  const providerName = input.providerName.trim();
  if (!providerName) {
    throw new ServiceError('Selecciona la empresa a remitir.');
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';

  return database.transaction(
    'rw',
    [
      database.cashSessions,
      database.saleItems,
      database.sales,
      database.cashMovements,
      database.serviceRemittances,
      database.auditLogs
    ],
    async () => {
      const session = await database.cashSessions.where('status').equals('open').first();
      if (!session) {
        throw new ServiceError('Abre la caja antes de registrar una remesa.');
      }

      const pendingList = await listPendingRemittancesByProvider(database);
      const target = pendingList.find((row) => row.providerName === providerName);
      if (!target || target.totalServiceAmountCents <= 0) {
        throw new ServiceError(`No hay montos pendientes por remitir a ${providerName}.`);
      }

      const createdAt = nowIso();
      const remittanceId = newId();
      const movementId = newId();

      const cashMovement: CashMovement = {
        id: movementId,
        sessionId: session.id,
        medium: input.medium,
        type: 'service_remittance',
        amountCents: -target.totalServiceAmountCents,
        remittanceId,
        description: `Remesa ${providerName}${input.notes?.trim() ? ` · ${input.notes.trim()}` : ''}`,
        idempotencyKey: `${remittanceId}:cash`,
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      const remittance: ServiceRemittance = {
        id: remittanceId,
        providerName,
        sessionId: session.id,
        movementId,
        amountCents: target.totalServiceAmountCents,
        notes: input.notes?.trim() || undefined,
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      await database.cashMovements.add(cashMovement);
      await database.serviceRemittances.add(remittance);

      for (const itemId of target.itemIds) {
        await database.saleItems.update(itemId, {
          remittanceId,
          remittedAt: createdAt
        });
      }

      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: 'service.remittance',
        entity: 'serviceRemittance',
        entityId: remittanceId,
        sessionId: session.id,
        after: {
          providerName,
          amountCents: target.totalServiceAmountCents,
          itemCount: target.itemCount,
          medium: input.medium
        },
        deviceId,
        createdAt
      });

      return remittance;
    }
  );
}
