import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';
import { MorePage } from './MorePage';
import { AuditPage } from '../features/audit/AuditPage';
import { BackupPage } from '../features/backup/BackupPage';
import { CashPage } from '../features/cash/CashPage';
import { ClientsPage } from '../features/clients/ClientsPage';
import { SellPage } from '../features/checkout/SellPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { CollectPage } from '../features/services/CollectPage';
import { PinLockGate } from '../features/settings/PinLockGate';
import { SettingsPage } from '../features/settings/SettingsPage';

export function App() {
  return (
    <PinLockGate>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<SellPage />} />

            <Route path="cobrar" element={<CollectPage />} />

            <Route path="clientes" element={<ClientsPage />} />

            <Route path="caja" element={<CashPage />} />

            <Route path="mas" element={<MorePage />} />
            <Route path="mas/historial" element={<HistoryPage />} />
            <Route path="mas/auditoria" element={<AuditPage />} />
            <Route path="mas/respaldo" element={<BackupPage />} />
            <Route path="mas/ajustes" element={<SettingsPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PinLockGate>
  );
}
