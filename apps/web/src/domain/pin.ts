import { LOCAL_OWNER_ID, db, readSetting, type MarielDB } from '../db/db';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';

const PIN_ITERATIONS = 100_000;

export class PinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinError';
  }
}

export function validatePinFormat(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) {
    return 'El PIN debe tener entre 4 y 6 dígitos numéricos.';
  }
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function hashPin(pin: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex) as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(bits));
}

/** Indica si la dueña tiene un PIN configurado actualmente. */
export async function isPinConfigured(database: MarielDB = db): Promise<boolean> {
  const owner = await database.users.get(LOCAL_OWNER_ID);
  return Boolean(owner?.pinHash);
}

/** Verifica si el PIN ingresado coincide con el de la dueña. */
export async function verifyOwnerPin(
  pin: string,
  database: MarielDB = db
): Promise<boolean> {
  const owner = await database.users.get(LOCAL_OWNER_ID);
  if (!owner || !owner.pinHash || !owner.pinSalt) return false;

  const candidate = await hashPin(pin, owner.pinSalt, owner.pinIterations || PIN_ITERATIONS);
  if (candidate !== owner.pinHash) return false;

  await database.users.update(LOCAL_OWNER_ID, { lastLoginAt: nowIso() });
  return true;
}

/** Configura o cambia el PIN de la dueña. Si ya existe uno, exige `currentPin`. */
export async function setOwnerPin(
  newPin: string,
  currentPin?: string,
  database: MarielDB = db
): Promise<void> {
  const formatError = validatePinFormat(newPin);
  if (formatError) throw new PinError(formatError);

  const owner = await database.users.get(LOCAL_OWNER_ID);
  if (!owner) throw new PinError('No se encontró el perfil local de la dueña.');

  if (owner.pinHash) {
    if (!currentPin || !(await verifyOwnerPin(currentPin, database))) {
      throw new PinError('El PIN actual es incorrecto.');
    }
  }

  const saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const pinHash = await hashPin(newPin, saltHex, PIN_ITERATIONS);
  const timestamp = nowIso();
  const deviceId = (await readSetting('deviceId', database)) || 'local';

  await database.transaction('rw', [database.users, database.auditLogs], async () => {
    await database.users.update(LOCAL_OWNER_ID, {
      pinHash,
      pinSalt: saltHex,
      pinIterations: PIN_ITERATIONS,
      updatedAt: timestamp
    });

    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'security.pin_change',
      entity: 'user',
      entityId: LOCAL_OWNER_ID,
      deviceId,
      createdAt: timestamp
    });
  });
}

/** Quita el PIN de acceso verificando el PIN actual. */
export async function clearOwnerPin(
  currentPin: string,
  database: MarielDB = db
): Promise<void> {
  if (!(await verifyOwnerPin(currentPin, database))) {
    throw new PinError('El PIN actual es incorrecto.');
  }

  const timestamp = nowIso();
  const deviceId = (await readSetting('deviceId', database)) || 'local';

  await database.transaction('rw', [database.users, database.auditLogs], async () => {
    await database.users.update(LOCAL_OWNER_ID, {
      pinHash: '',
      pinSalt: '',
      pinIterations: 0,
      updatedAt: timestamp
    });

    await database.auditLogs.add({
      id: newId(),
      actorId: LOCAL_OWNER_ID,
      action: 'security.pin_remove',
      entity: 'user',
      entityId: LOCAL_OWNER_ID,
      deviceId,
      createdAt: timestamp
    });
  });
}
