/**
 * Utilidades criptográficas locales usando Web Crypto API.
 * Formato del archivo cifrado:
 * [7 bytes magic "MARIEL1"][16 bytes salt][12 bytes iv][ciphertext AES-GCM-256]
 */

const MAGIC = new TextEncoder().encode('MARIEL1');
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 210_000;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Cifra un arreglo de bytes con AES-GCM-256 derivado de una passphrase. */
export async function encryptBytes(
  plainBytes: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  if (passphrase.trim().length < 6) {
    throw new CryptoError('La frase de respaldo debe tener al menos 6 caracteres.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveAesKey(passphrase, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainBytes as BufferSource
  );
  const cipherBytes = new Uint8Array(encrypted);

  const output = new Uint8Array(
    MAGIC.length + SALT_LENGTH + IV_LENGTH + cipherBytes.length
  );
  output.set(MAGIC, 0);
  output.set(salt, MAGIC.length);
  output.set(iv, MAGIC.length + SALT_LENGTH);
  output.set(cipherBytes, MAGIC.length + SALT_LENGTH + IV_LENGTH);

  return output;
}

/** Descifra un blob generado por `encryptBytes`. */
export async function decryptBytes(
  encryptedBytes: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  const headerLength = MAGIC.length + SALT_LENGTH + IV_LENGTH;
  if (encryptedBytes.length <= headerLength) {
    throw new CryptoError('El archivo de respaldo está dañado o incompleto.');
  }

  for (let i = 0; i < MAGIC.length; i += 1) {
    if (encryptedBytes[i] !== MAGIC[i]) {
      throw new CryptoError('El archivo no es un respaldo válido de Sistema Mariel.');
    }
  }

  const salt = encryptedBytes.slice(MAGIC.length, MAGIC.length + SALT_LENGTH);
  const iv = encryptedBytes.slice(
    MAGIC.length + SALT_LENGTH,
    MAGIC.length + SALT_LENGTH + IV_LENGTH
  );
  const cipherBytes = encryptedBytes.slice(headerLength);

  const key = await deriveAesKey(passphrase, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new CryptoError('Frase de respaldo incorrecta o archivo alterado.');
  }
}

/** Calcula el hash SHA-256 en hexadecimal (64 caracteres). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
