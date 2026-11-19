import {
  LOCAL_OWNER_ID,
  db,
  readSetting,
  type AccountMovement,
  type CashMovement,
  type CashMovementMedium,
  type Cents,
  type Client,
  type MarielDB
} from '../db/db';
import { normalizeQrReference, validateQrReference } from '../features/checkout/payments';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { isValidAmount } from '../lib/money';
import { normalizeSearchName } from '../lib/search';

export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

export type SaveClientInput = {
  name: string;
  phone?: string;
  alias?: string;
  notes?: string;
};

/** Crea un nuevo cliente activo con saldo inicial en cero. */
export async function createClient(
  input: SaveClientInput,
  database: MarielDB = db
): Promise<Client> {
  const name = input.name.trim();
  if (!name) {
    throw new ClientError('El nombre del cliente es obligatorio.');
  }

  const searchName = normalizeSearchName(name);
  if (!searchName) {
    throw new ClientError('El nombre del cliente debe tener letras o números.');
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const timestamp = nowIso();

  const client: Client = {
    id: newId(),
    name,
    searchName,
    phone: input.phone?.trim() || undefined,
    alias: input.alias?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    balanceCents: 0,
    active: 1,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await database.transaction('rw', [database.clients, database.auditLogs], async () => {
    await database.clients.add(client);
    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'client.create',
      entity: 'client',
      entityId: client.id,
      after: { name: client.name, phone: client.phone, alias: client.alias },
      deviceId,
      createdAt: timestamp
    });
  });

  return client;
}

/** Actualiza los datos de un cliente existente. */
export async function updateClient(
  clientId: string,
  input: SaveClientInput,
  database: MarielDB = db
): Promise<Client> {
  const name = input.name.trim();
  if (!name) {
    throw new ClientError('El nombre del cliente es obligatorio.');
  }

  const searchName = normalizeSearchName(name);
  if (!searchName) {
    throw new ClientError('El nombre del cliente debe tener letras o números.');
  }

  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const timestamp = nowIso();

  return database.transaction('rw', [database.clients, database.auditLogs], async () => {
    const existing = await database.clients.get(clientId);
    if (!existing) {
      throw new ClientError('El cliente no existe.');
    }

    const updated: Client = {
      ...existing,
      name,
      searchName,
      phone: input.phone?.trim() || undefined,
      alias: input.alias?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      updatedAt: timestamp
    };

    await database.clients.put(updated);
    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'client.update',
      entity: 'client',
      entityId: clientId,
      before: { name: existing.name, phone: existing.phone, alias: existing.alias },
      after: { name: updated.name, phone: updated.phone, alias: updated.alias },
      deviceId,
      createdAt: timestamp
    });

    return updated;
  });
}

/** Desactiva un cliente sin borrarlo físicamente. */
export async function deactivateClient(
  clientId: string,
  database: MarielDB = db
): Promise<void> {
  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const timestamp = nowIso();

  await database.transaction('rw', [database.clients, database.auditLogs], async () => {
    const existing = await database.clients.get(clientId);
    if (!existing) {
      throw new ClientError('El cliente no existe.');
    }
    if (existing.active === 0) return;

    await database.clients.update(clientId, { active: 0, updatedAt: timestamp });
    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'client.deactivate',
      entity: 'client',
      entityId: clientId,
      before: { active: 1 },
      after: { active: 0 },
      deviceId,
      createdAt: timestamp
    });
  });
}

/** Lista los clientes activos, filtrados por nombre/alias/teléfono si hay consulta. */
export async function listActiveClients(
  query = '',
  database: MarielDB = db
): Promise<Client[]> {
  const all = await database.clients.orderBy('searchName').toArray();
  const active = all.filter((client) => client.active === 1);
  const normalized = normalizeSearchName(query);

  if (!normalized) return active;

  return active.filter((client) => {
    const aliasSearch = client.alias ? normalizeSearchName(client.alias) : '';
    const phoneSearch = client.phone ? normalizeSearchName(client.phone) : '';
    return (
      client.searchName.includes(normalized) ||
      aliasSearch.includes(normalized) ||
      phoneSearch.includes(normalized)
    );
  });
}

/** Últimos movimientos de la cuenta de un cliente, del más reciente al más antiguo. */
export async function listClientMovements(
  clientId: string,
  limit = 30,
  database: MarielDB = db
): Promise<AccountMovement[]> {
  const rows = await database.accountMovements
    .where('clientId')
    .equals(clientId)
    .toArray();

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export type ClientCashOperationInput = {
  clientId: string;
  type: 'deposit' | 'withdrawal';
  medium: CashMovementMedium;
  amountCents: Cents;
  qrReference?: string;
  description?: string;
};

/**
 * Registra un depósito o retiro de cliente en una sola transacción:
 * actualiza `accountMovements`, `clients.balanceCents`, `cashMovements` y `auditLogs`.
 */
export async function recordClientCashOperation(
  input: ClientCashOperationInput,
  database: MarielDB = db
): Promise<AccountMovement> {
  if (!isValidAmount(input.amountCents) || input.amountCents <= 0) {
    throw new ClientError('El monto debe ser mayor a Bs 0,00.');
  }

  let normalizedQrRef: string | undefined;
  if (input.medium === 'qr') {
    const refError = validateQrReference(input.qrReference ?? '');
    if (refError) {
      throw new ClientError(refError);
    }
    normalizedQrRef = normalizeQrReference(input.qrReference ?? '');
  }

  const [deviceId, allowNegative] = await Promise.all([
    readSetting('deviceId', database),
    readSetting('allowNegativeBalance', database)
  ]);

  return database.transaction(
    'rw',
    [
      database.clients,
      database.accountMovements,
      database.cashSessions,
      database.cashMovements,
      database.auditLogs
    ],
    async () => {
      const session = await database.cashSessions.where('status').equals('open').first();
      if (!session) {
        throw new ClientError('Abre la caja antes de registrar depósitos o retiros.');
      }

      const client = await database.clients.get(input.clientId);
      if (!client || client.active !== 1) {
        throw new ClientError('El cliente no existe o está inactivo.');
      }

      const signedAmount = input.type === 'deposit' ? input.amountCents : -input.amountCents;
      const nextBalance = client.balanceCents + signedAmount;

      if (input.type === 'withdrawal' && !allowNegative && nextBalance < 0) {
        throw new ClientError('Saldo insuficiente para realizar este retiro.');
      }

      const createdAt = nowIso();
      const movementId = newId();
      const cashMovementId = newId();

      const accountMovement: AccountMovement = {
        id: movementId,
        clientId: client.id,
        sessionId: session.id,
        type: input.type,
        amountCents: signedAmount,
        cashCents: input.medium === 'cash' ? signedAmount : 0,
        qrCents: input.medium === 'qr' ? signedAmount : 0,
        balanceAfterCents: nextBalance,
        method: input.medium,
        qrReference: normalizedQrRef,
        description: input.description?.trim() || undefined,
        idempotencyKey: newId(),
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      const cashMovement: CashMovement = {
        id: cashMovementId,
        sessionId: session.id,
        medium: input.medium,
        type: input.type === 'deposit' ? 'client_deposit' : 'client_withdrawal',
        amountCents: signedAmount,
        accountMovementId: movementId,
        description: `${client.name}${input.description?.trim() ? ` · ${input.description.trim()}` : ''}`,
        idempotencyKey: `${movementId}:cash`,
        createdBy: LOCAL_OWNER_ID,
        createdAt
      };

      await database.accountMovements.add(accountMovement);
      await database.clients.update(client.id, {
        balanceCents: nextBalance,
        updatedAt: createdAt
      });
      await database.cashMovements.add(cashMovement);
      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: input.type === 'deposit' ? 'client.deposit' : 'client.withdrawal',
        entity: 'accountMovement',
        entityId: movementId,
        sessionId: session.id,
        before: { balanceCents: client.balanceCents },
        after: {
          balanceCents: nextBalance,
          amountCents: signedAmount,
          medium: input.medium
        },
        deviceId: deviceId || 'local',
        createdAt
      });

      return accountMovement;
    }
  );
}
