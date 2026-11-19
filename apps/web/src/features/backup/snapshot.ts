import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import {
  LOCAL_OWNER_ID,
  SCHEMA_VERSION,
  db,
  readSetting,
  type Attachment,
  type MarielDB
} from '../../db/db';
import { decryptBytes, encryptBytes, sha256Hex } from '../../lib/crypto';
import { nowIso } from '../../lib/dates';
import { newId } from '../../lib/ids';

export type BackupKind = 'quick' | 'full';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const SerializedAttachmentSchema = z.object({
  id: z.string(),
  ownerType: z.enum(['sale_payment', 'expense', 'client_movement', 'business_qr']),
  ownerId: z.string(),
  mimeType: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  size: z.number(),
  base64: z.string(),
  createdAt: z.string()
});

const BackupSnapshotSchema = z.object({
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  kind: z.enum(['quick', 'full']),
  createdAt: z.string(),
  deviceId: z.string(),
  tables: z.object({
    settings: z.array(z.any()),
    users: z.array(z.any()),
    clients: z.array(z.any()),
    accountMovements: z.array(z.any()),
    products: z.array(z.any()),
    services: z.array(z.any()),
    cashSessions: z.array(z.any()),
    cashDenominations: z.array(z.any()),
    cashMovements: z.array(z.any()),
    sales: z.array(z.any()),
    saleItems: z.array(z.any()),
    salePayments: z.array(z.any()),
    expenses: z.array(z.any()),
    serviceRemittances: z.array(z.any()),
    auditLogs: z.array(z.any()),
    attachments: z.array(SerializedAttachmentSchema),
    checkoutDrafts: z.array(z.any()),
    counters: z.array(z.any()),
    calculatorEntries: z.array(z.any())
  })
});

export type BackupSnapshot = z.infer<typeof BackupSnapshotSchema>;

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export type ExportedBackup = {
  bytes: Uint8Array;
  byteSize: number;
  sha256: string;
  fileName: string;
  kind: BackupKind;
  createdAt: string;
  deviceId: string;
};

/**
 * Crea un snapshot de la base local, lo comprime con gzip y lo cifra con AES-GCM.
 */
export async function exportEncryptedBackup(
  input: { kind: BackupKind; passphrase: string },
  database: MarielDB = db
): Promise<ExportedBackup> {
  const deviceId = (await readSetting('deviceId', database)) || 'local';
  const createdAt = nowIso();

  const snapshot = await database.transaction(
    'r',
    [
      database.settings,
      database.users,
      database.clients,
      database.accountMovements,
      database.products,
      database.services,
      database.cashSessions,
      database.cashDenominations,
      database.cashMovements,
      database.sales,
      database.saleItems,
      database.salePayments,
      database.expenses,
      database.serviceRemittances,
      database.auditLogs,
      database.attachments,
      database.checkoutDrafts,
      database.counters,
      database.calculatorEntries
    ],
    async (): Promise<BackupSnapshot> => {
      const rawAttachments =
        input.kind === 'full' ? await database.attachments.toArray() : [];

      const attachments = await Promise.all(
        rawAttachments.map(async (att) => ({
          id: att.id,
          ownerType: att.ownerType,
          ownerId: att.ownerId,
          mimeType: att.mimeType,
          width: att.width,
          height: att.height,
          size: att.size,
          base64: await blobToBase64(att.blob),
          createdAt: att.createdAt
        }))
      );

      return {
        schemaVersion: SCHEMA_VERSION,
        appVersion: '0.1.0',
        kind: input.kind,
        createdAt,
        deviceId,
        tables: {
          settings: await database.settings.toArray(),
          users: await database.users.toArray(),
          clients: await database.clients.toArray(),
          accountMovements: await database.accountMovements.toArray(),
          products: await database.products.toArray(),
          services: await database.services.toArray(),
          cashSessions: await database.cashSessions.toArray(),
          cashDenominations: await database.cashDenominations.toArray(),
          cashMovements: await database.cashMovements.toArray(),
          sales: await database.sales.toArray(),
          saleItems: await database.saleItems.toArray(),
          salePayments: await database.salePayments.toArray(),
          expenses: await database.expenses.toArray(),
          serviceRemittances: await database.serviceRemittances.toArray(),
          auditLogs: await database.auditLogs.toArray(),
          attachments,
          checkoutDrafts: await database.checkoutDrafts.toArray(),
          counters: await database.counters.toArray(),
          calculatorEntries: await database.calculatorEntries.toArray()
        }
      };
    }
  );

  const jsonBytes = strToU8(JSON.stringify(snapshot));
  const compressed = gzipSync(jsonBytes, { level: 6 });
  const encrypted = await encryptBytes(compressed, input.passphrase);
  const sha256 = await sha256Hex(encrypted);

  const safeStamp = createdAt.replace(/[:.]/g, '-');
  const fileName = `mariel-${safeStamp}-${input.kind}.mariel.enc`;

  await database.backupState.put({
    key: 'lastLocalExportAt',
    value: createdAt,
    updatedAt: createdAt
  });

  return {
    bytes: encrypted,
    byteSize: encrypted.byteLength,
    sha256,
    fileName,
    kind: input.kind,
    createdAt,
    deviceId
  };
}

/**
 * Descifra, descomprime, valida con Zod y restaura un respaldo en Dexie.
 */
export async function restoreEncryptedBackup(
  input: { encryptedBytes: Uint8Array; passphrase: string },
  database: MarielDB = db
): Promise<BackupSnapshot> {
  const compressed = await decryptBytes(input.encryptedBytes, input.passphrase);

  let parsed: unknown;
  try {
    const jsonText = strFromU8(gunzipSync(compressed));
    parsed = JSON.parse(jsonText);
  } catch {
    throw new BackupError('No se pudo descomprimir o leer el contenido del respaldo.');
  }

  const validation = BackupSnapshotSchema.safeParse(parsed);
  if (!validation.success) {
    throw new BackupError('El formato del respaldo no es compatible con esta versión.');
  }

  const snapshot = validation.data;
  if (snapshot.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError(
      'Este respaldo pertenece a una versión más nueva de la aplicación.'
    );
  }

  const restoredAt = nowIso();
  const deviceId = (await readSetting('deviceId', database)) || 'local';

  const attachmentsToPut: Attachment[] = snapshot.tables.attachments.map((att) => ({
    id: att.id,
    ownerType: att.ownerType,
    ownerId: att.ownerId,
    mimeType: att.mimeType,
    width: att.width,
    height: att.height,
    size: att.size,
    blob: base64ToBlob(att.base64, att.mimeType),
    createdAt: att.createdAt
  }));

  await database.transaction(
    'rw',
    [
      database.settings,
      database.users,
      database.clients,
      database.accountMovements,
      database.products,
      database.services,
      database.cashSessions,
      database.cashDenominations,
      database.cashMovements,
      database.sales,
      database.saleItems,
      database.salePayments,
      database.expenses,
      database.serviceRemittances,
      database.auditLogs,
      database.attachments,
      database.checkoutDrafts,
      database.counters,
      database.calculatorEntries,
      database.backupState
    ],
    async () => {
      await Promise.all([
        database.settings.clear(),
        database.users.clear(),
        database.clients.clear(),
        database.accountMovements.clear(),
        database.products.clear(),
        database.services.clear(),
        database.cashSessions.clear(),
        database.cashDenominations.clear(),
        database.cashMovements.clear(),
        database.sales.clear(),
        database.saleItems.clear(),
        database.salePayments.clear(),
        database.expenses.clear(),
        database.serviceRemittances.clear(),
        database.auditLogs.clear(),
        database.attachments.clear(),
        database.checkoutDrafts.clear(),
        database.counters.clear(),
        database.calculatorEntries.clear()
      ]);

      await Promise.all([
        database.settings.bulkPut(snapshot.tables.settings),
        database.users.bulkPut(snapshot.tables.users),
        database.clients.bulkPut(snapshot.tables.clients),
        database.accountMovements.bulkPut(snapshot.tables.accountMovements),
        database.products.bulkPut(snapshot.tables.products),
        database.services.bulkPut(snapshot.tables.services),
        database.cashSessions.bulkPut(snapshot.tables.cashSessions),
        database.cashDenominations.bulkPut(snapshot.tables.cashDenominations),
        database.cashMovements.bulkPut(snapshot.tables.cashMovements),
        database.sales.bulkPut(snapshot.tables.sales),
        database.saleItems.bulkPut(snapshot.tables.saleItems),
        database.salePayments.bulkPut(snapshot.tables.salePayments),
        database.expenses.bulkPut(snapshot.tables.expenses),
        database.serviceRemittances.bulkPut(snapshot.tables.serviceRemittances),
        database.auditLogs.bulkPut(snapshot.tables.auditLogs),
        database.attachments.bulkPut(attachmentsToPut),
        database.checkoutDrafts.bulkPut(snapshot.tables.checkoutDrafts),
        database.counters.bulkPut(snapshot.tables.counters),
        database.calculatorEntries.bulkPut(snapshot.tables.calculatorEntries)
      ]);

      await database.auditLogs.add({
        id: newId(),
        actorId: LOCAL_OWNER_ID,
        action: 'backup.restore',
        entity: 'backup',
        entityId: snapshot.createdAt,
        after: {
          kind: snapshot.kind,
          sourceDeviceId: snapshot.deviceId,
          snapshotCreatedAt: snapshot.createdAt
        },
        deviceId,
        createdAt: restoredAt
      });

      await database.backupState.put({
        key: 'lastRestoreAt',
        value: restoredAt,
        updatedAt: restoredAt
      });
    }
  );

  return snapshot;
}
