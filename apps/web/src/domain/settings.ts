import {
  db,
  readSetting,
  writeSetting,
  type Attachment,
  type MarielDB
} from '../db/db';
import { nowIso } from '../lib/dates';

export const BUSINESS_QR_ATTACHMENT_ID = 'business-qr';
export const MAX_QR_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_QR_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const MAX_QR_IMAGE_SIDE = 1200;
const QR_JPEG_QUALITY = 0.88;

export class QrImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrImageError';
  }
}

/** Valida tipo y tamaño antes de tocar la imagen. */
export function validateQrImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ACCEPTED_QR_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_QR_IMAGE_TYPES)[number])) {
    return 'Elige una imagen PNG, JPG o WebP.';
  }
  if (file.size <= 0) {
    return 'La imagen está vacía.';
  }
  if (file.size > MAX_QR_IMAGE_BYTES) {
    return 'La imagen no puede superar 5 MB.';
  }
  return null;
}

/** Reduce la imagen para que el respaldo no crezca de más. */
async function resizeQrImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_QR_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    // Fondo blanco: un QR con transparencia debe seguir siendo escaneable.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', QR_JPEG_QUALITY);
    });

    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

/** Imagen del QR guardada, o undefined si todavía no se cargó. */
export async function getBusinessQr(
  database: MarielDB = db
): Promise<Attachment | undefined> {
  const attachmentId = await readSetting('qrImageAttachmentId', database);
  if (!attachmentId) return undefined;

  return database.attachments.get(attachmentId);
}

/**
 * Guarda la imagen del QR del negocio en el teléfono.
 * Reemplaza la anterior; es configuración, no un registro de ventas.
 */
export async function saveBusinessQr(
  file: File,
  database: MarielDB = db
): Promise<Attachment> {
  const validationError = validateQrImageFile(file);
  if (validationError) throw new QrImageError(validationError);

  const blob = await resizeQrImage(file);
  const attachment: Attachment = {
    id: BUSINESS_QR_ATTACHMENT_ID,
    ownerType: 'business_qr',
    ownerId: 'business',
    mimeType: blob.type || 'image/jpeg',
    size: blob.size,
    blob,
    createdAt: nowIso()
  };

  await database.transaction(
    'rw',
    database.attachments,
    database.settings,
    async () => {
      await database.attachments.put(attachment);
      await writeSetting('qrImageAttachmentId', attachment.id, database);
    }
  );

  return attachment;
}

/** Quita el QR del negocio de este teléfono. */
export async function removeBusinessQr(database: MarielDB = db): Promise<void> {
  await database.transaction(
    'rw',
    database.attachments,
    database.settings,
    async () => {
      await database.attachments.delete(BUSINESS_QR_ATTACHMENT_ID);
      await writeSetting('qrImageAttachmentId', '', database);
    }
  );
}
