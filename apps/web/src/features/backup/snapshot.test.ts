import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, initializeDatabase } from '../../db/db';
import { openCashSession } from '../../domain/cash';
import { createProduct } from '../../domain/catalog';
import { createClient, recordClientCashOperation } from '../../domain/clients';
import { createSale } from '../../domain/sales';
import { CryptoError } from '../../lib/crypto';
import { exportEncryptedBackup, restoreEncryptedBackup } from './snapshot';

describe('respaldo cifrado', () => {
  let sourceDb: MarielDB;
  let targetDb: MarielDB;
  let seq = 0;

  beforeEach(async () => {
    seq += 1;
    sourceDb = new MarielDB(`mariel-backup-src-${seq}`);
    targetDb = new MarielDB(`mariel-backup-dst-${seq}`);
    await initializeDatabase(sourceDb);
    await initializeDatabase(targetDb);
  });

  afterEach(async () => {
    await sourceDb.delete();
    await targetDb.delete();
  });

  it('exporta, comprime, cifra y restaura una base completa en otro contexto', async () => {
    await openCashSession({ openingCashCents: 10_000 }, sourceDb);
    const product = await createProduct({ name: 'Pan de queso', priceCents: 300 }, sourceDb);
    const client = await createClient({ name: 'Rosa Pérez' }, sourceDb);
    await recordClientCashOperation(
      { clientId: client.id, type: 'deposit', medium: 'cash', amountCents: 5000 },
      sourceDb
    );
    await createSale(
      {
        items: [{ productId: product.id, quantity: 2 }],
        payments: [{ method: 'cash', amountCents: 600, cashReceivedCents: 1000, changeCents: 400 }]
      },
      sourceDb
    );

    const exported = await exportEncryptedBackup(
      { kind: 'quick', passphrase: 'clave-super-secreta' },
      sourceDb
    );

    expect(exported.byteSize).toBeGreaterThan(0);
    expect(exported.sha256).toHaveLength(64);
    expect(exported.fileName).toMatch(/\.mariel\.enc$/);

    // Restaurar en otra base limpia
    const snapshot = await restoreEncryptedBackup(
      { encryptedBytes: exported.bytes, passphrase: 'clave-super-secreta' },
      targetDb
    );

    expect(snapshot.kind).toBe('quick');
    expect((await targetDb.products.toArray()).map((p) => p.name)).toEqual(['Pan de queso']);
    expect((await targetDb.clients.toArray()).map((c) => c.balanceCents)).toEqual([5000]);
    expect(await targetDb.sales.count()).toBe(1);
    expect(await targetDb.cashSessions.count()).toBe(1);

    const logs = await targetDb.auditLogs.toArray();
    expect(logs.some((log) => log.action === 'backup.restore')).toBe(true);
  });

  it('rechaza restaurar con frase incorrecta sin alterar la base destino', async () => {
    await createProduct({ name: 'Original', priceCents: 500 }, targetDb);
    const exported = await exportEncryptedBackup(
      { kind: 'quick', passphrase: 'clave-correcta' },
      sourceDb
    );

    await expect(
      restoreEncryptedBackup(
        { encryptedBytes: exported.bytes, passphrase: 'clave-erronea' },
        targetDb
      )
    ).rejects.toBeInstanceOf(CryptoError);

    expect((await targetDb.products.toArray()).map((p) => p.name)).toEqual(['Original']);
  });
});
