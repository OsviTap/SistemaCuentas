import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../../db/db';
import { formatDateTime } from '../../lib/dates';

const ACTION_LABELS: Record<string, string> = {
  'cash.open': 'Apertura de caja',
  'cash.close': 'Cierre de caja (cuadrado)',
  'cash.close_with_difference': 'Cierre de caja con diferencia',
  'cash.expense': 'Gasto registrado',
  'cash.owner_withdrawal': 'Retiro de la dueña',
  'sale.create': 'Venta registrada',
  'sale.void': 'Venta anulada',
  'service.create': 'Servicio creado',
  'service.deactivate': 'Servicio desactivado',
  'service.collect': 'Servicio cobrado',
  'service.remittance': 'Remesa a empresa',
  'client.create': 'Cliente creado',
  'client.update': 'Cliente editado',
  'client.deactivate': 'Cliente desactivado',
  'client.deposit': 'Depósito de cliente',
  'client.withdrawal': 'Retiro de cliente',
  'backup.restore': 'Respaldo restaurado',
  'security.pin_change': 'PIN configurado o cambiado',
  'security.pin_remove': 'PIN eliminado'
};

export function AuditPage() {
  const logs = useLiveQuery(
    () => db.auditLogs.orderBy('createdAt').reverse().limit(100).toArray(),
    []
  );

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Link
            to="/mas"
            aria-label="Volver a Más"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-ink-700 active:bg-ink-200"
          >
            ←
          </Link>
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Más</p>
            <h1 className="text-2xl font-bold text-ink-900">Auditoría</h1>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {logs === undefined ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/60" aria-hidden="true" />
          </div>
        ) : logs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-ink-300 bg-white/60 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-ink-700">Sin registros todavía</p>
            <p className="mt-1 text-xs text-ink-500">
              Las acciones operativas y de seguridad aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink-900">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </p>
                  <span className="shrink-0 text-xs text-ink-500">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                {log.reason ? (
                  <p className="mt-1 text-xs text-ink-600">Motivo: {log.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
