import { describe, expect, it } from 'vitest';
import { CryptoError, decryptBytes, encryptBytes, sha256Hex } from './crypto';

describe('crypto', () => {
  it('cifra y descifra bytes con la passphrase correcta', async () => {
    const plain = new TextEncoder().encode('{"ok":true,"total":12500}');
    const encrypted = await encryptBytes(plain, 'mariel-segura-2026');
    const decrypted = await decryptBytes(encrypted, 'mariel-segura-2026');

    expect(new TextDecoder().decode(decrypted)).toBe('{"ok":true,"total":12500}');
  });

  it('rechaza passphrase incorrecta o archivo alterado', async () => {
    const plain = new TextEncoder().encode('datos-sensibles');
    const encrypted = await encryptBytes(plain, 'clave-correcta');

    await expect(decryptBytes(encrypted, 'clave-incorrecta')).rejects.toBeInstanceOf(
      CryptoError
    );

    const corrupted = new Uint8Array(encrypted);
    const lastIdx = corrupted.length - 1;
    corrupted[lastIdx] = (corrupted[lastIdx] ?? 0) ^ 0xff;
    await expect(decryptBytes(corrupted, 'clave-correcta')).rejects.toBeInstanceOf(
      CryptoError
    );
  });

  it('calcula sha256 de 64 caracteres hexadecimales', async () => {
    const hash = await sha256Hex(new TextEncoder().encode('hola'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
