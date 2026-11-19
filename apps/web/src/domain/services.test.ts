import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase } from '../db/db';
import { getSessionTotals, openCashSession } from './cash';
import { createClient, recordClientCashOperation } from './clients';
import {
  ServiceError,
  calculateServiceCommission,
  collectService,
  createService,
  deactivateService,
  listActiveServices,
  listPendingRemittancesByProvider,
  remitProviderServices
} from './services';

describe('servicios y remesas', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(async () => {
    sequence += 1;
    database = new MarielDB(`mariel-services-test-${sequence}`);
    await initializeDatabase(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('calcula comisión fija más porcentaje en puntos base', () => {
    // 100 Bs + 2 Bs fijos + 1.5% (150 bps) = 100 + 2 + 1.50 = 103.50 Bs
    const res = calculateServiceCommission(10_000, 200, 150);
    expect(res.commissionCents).toBe(350);
    expect(res.totalCents).toBe(10_350);

    expect(() => calculateServiceCommission(0, 200, 0)).toThrow(ServiceError);
  });

  it('crea, busca y desactiva servicios sin borrarlos', async () => {
    const luz = await createService(
      {
        name: 'Luz eléctrica',
        providerName: 'DELAPAZ',
        commissionFixedCents: 200,
        requiresSupplyNumber: true
      },
      database
    );

    expect((await listActiveServices('delapaz', database)).map((s) => s.id)).toEqual([
      luz.id
    ]);

    await deactivateService(luz.id, database);
    expect(await listActiveServices('', database)).toHaveLength(0);
  });

  it('cobra un servicio, exige suministro si corresponde y permite remitir a la empresa', async () => {
    const session = await openCashSession({ openingCashCents: 10_000 }, database);
    const agua = await createService(
      {
        name: 'Agua potable',
        providerName: 'EPSAS',
        commissionFixedCents: 200,
        requiresSupplyNumber: true
      },
      database
    );

    // Falta número de suministro
    await expect(
      collectService(
        {
          serviceId: agua.id,
          serviceAmountCents: 5000,
          payments: [
            { method: 'cash', amountCents: 5200, cashReceivedCents: 5200, changeCents: 0 }
          ]
        },
        database
      )
    ).rejects.toBeInstanceOf(ServiceError);

    const collected = await collectService(
      {
        serviceId: agua.id,
        serviceAmountCents: 5000,
        supplyNumber: 'MED-9988',
        payments: [
          { method: 'cash', amountCents: 5200, cashReceivedCents: 10_000, changeCents: 4800 }
        ]
      },
      database
    );

    expect(collected.item.kind).toBe('service');
    expect(collected.item.serviceAmountCents).toBe(5000);
    expect(collected.item.commissionCents).toBe(200);
    expect(collected.item.supplyNumber).toBe('MED-9988');

    // Caja tiene 100 Bs apertura + 52 Bs cobrados = 152 Bs
    let totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(15_200);

    // Pendientes por remitir: 50 Bs para EPSAS
    let pending = await listPendingRemittancesByProvider(database);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.providerName).toBe('EPSAS');
    expect(pending[0]?.totalServiceAmountCents).toBe(5000);
    expect(pending[0]?.totalCommissionCents).toBe(200);

    // Remitir a EPSAS en efectivo: sale 50 Bs de caja, queda la comisión (2 Bs) + apertura
    const remittance = await remitProviderServices(
      { providerName: 'EPSAS', medium: 'cash', notes: 'Pago en agencia' },
      database
    );
    expect(remittance.amountCents).toBe(5000);

    totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(10_200);

    pending = await listPendingRemittancesByProvider(database);
    expect(pending).toHaveLength(0);
  });

  it('permite cobrar un servicio con saldo de cliente', async () => {
    const session = await openCashSession({ openingCashCents: 5000 }, database);
    const client = await createClient({ name: 'Pedro Rojas' }, database);
    await recordClientCashOperation(
      { clientId: client.id, type: 'deposit', medium: 'cash', amountCents: 6000 },
      database
    );

    const recarga = await createService(
      {
        name: 'Recarga Entel',
        providerName: 'Entel',
        fixedAmountCents: 3000,
        commissionFixedCents: 100,
        requiresSupplyNumber: true
      },
      database
    );

    await collectService(
      {
        serviceId: recarga.id,
        serviceAmountCents: 3000,
        supplyNumber: '71234567',
        payments: [{ method: 'account', amountCents: 3100, clientId: client.id }]
      },
      database
    );

    const refreshedClient = await database.clients.get(client.id);
    expect(refreshedClient?.balanceCents).toBe(2900);

    // Caja sigue con 5000 apertura + 6000 depósito = 11000
    const totals = await getSessionTotals(session, database);
    expect(totals.expectedCashCents).toBe(11_000);
  });
});
