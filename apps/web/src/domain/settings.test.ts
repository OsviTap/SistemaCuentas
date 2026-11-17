import { describe, expect, it } from 'vitest';
import {
  MAX_QR_IMAGE_BYTES,
  validateQrImageFile
} from './settings';

function fakeFile(type: string, size: number): { type: string; size: number } {
  return { type, size };
}

describe('validateQrImageFile', () => {
  it('acepta PNG, JPG y WebP dentro del límite', () => {
    expect(validateQrImageFile(fakeFile('image/png', 1000))).toBeNull();
    expect(validateQrImageFile(fakeFile('image/jpeg', 1000))).toBeNull();
    expect(validateQrImageFile(fakeFile('image/webp', 1000))).toBeNull();
  });

  it('rechaza formatos que no son imagen', () => {
    expect(validateQrImageFile(fakeFile('application/pdf', 1000))).toContain('PNG');
  });

  it('rechaza imágenes vacías o demasiado grandes', () => {
    expect(validateQrImageFile(fakeFile('image/png', 0))).toContain('vacía');
    expect(validateQrImageFile(fakeFile('image/png', MAX_QR_IMAGE_BYTES + 1))).toContain(
      '5 MB'
    );
  });
});
