import { useEffect, useState } from 'react';
import { copyTextToClipboard, shareTextReport } from '../../lib/share';

type CashReportSheetProps = {
  title: string;
  subtitle?: string;
  reportText: string;
  onClose: () => void;
  closeLabel?: string;
};

export function CashReportSheet({
  title,
  subtitle,
  reportText,
  onClose,
  closeLabel = 'Listo'
}: CashReportSheetProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleShare = async () => {
    const result = await shareTextReport(title, reportText);
    if (result === 'shared') {
      setFeedback('Resumen compartido.');
    } else if (result === 'copied') {
      setFeedback('Texto copiado para pegar en WhatsApp.');
    } else if (result === 'failed') {
      setFeedback('No se pudo compartir automáticamente.');
    }
  };

  const handleCopy = async () => {
    const result = await copyTextToClipboard(reportText);
    setFeedback(
      result === 'copied'
        ? 'Texto copiado al portapapeles.'
        : 'No se pudo copiar el texto.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/60"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mt-8 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-ink-100">
        <header className="flex shrink-0 items-center justify-between border-b border-ink-200 bg-white px-4 py-3 rounded-t-3xl">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{title}</h2>
            {subtitle ? <p className="text-xs text-ink-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 px-3 items-center justify-center rounded-xl bg-ink-100 text-sm font-semibold text-ink-700 active:bg-ink-200"
          >
            {closeLabel}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <pre className="whitespace-pre-wrap rounded-2xl bg-white p-4 font-sans text-sm leading-relaxed text-ink-900 shadow-xs">
            {reportText}
          </pre>

          {feedback ? (
            <p className="mt-3 rounded-xl bg-brand-100 px-4 py-2 text-center text-sm font-medium text-brand-900">
              {feedback}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-ink-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="h-12 rounded-2xl bg-ink-100 text-sm font-bold text-ink-800 active:bg-ink-200"
            >
              Copiar texto
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="h-12 rounded-2xl bg-brand-600 text-sm font-bold text-white active:bg-brand-700"
            >
              Compartir WhatsApp
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

