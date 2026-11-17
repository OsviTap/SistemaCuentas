import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';
import { MorePage } from './MorePage';
import { PlaceholderPage } from './PlaceholderPage';
import { CashPage } from '../features/cash/CashPage';
import { SellPage } from '../features/checkout/SellPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { CollectPage } from '../features/services/CollectPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<SellPage />} />

          <Route path="cobrar" element={<CollectPage />} />

          <Route
            path="clientes"
            element={
              <PlaceholderPage
                title="Clientes"
                phase="fase 5"
                description="Cuentas, depósitos, retiros y saldo de cada cliente."
              />
            }
          />

          <Route path="caja" element={<CashPage />} />

          <Route path="mas" element={<MorePage />} />
          <Route path="mas/historial" element={<HistoryPage />} />
          <Route path="mas/ajustes" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
