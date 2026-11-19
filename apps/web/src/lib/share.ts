export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Comparte un reporte de texto usando Web Share API (ideal para WhatsApp en Android)
 * y cae al portapapeles si compartir no está disponible.
 */
export async function shareTextReport(title: string, text: string): Promise<ShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  return copyTextToClipboard(text);
}

/** Copia texto al portapapeles. */
export async function copyTextToClipboard(text: string): Promise<'copied' | 'failed'> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return 'failed';
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

