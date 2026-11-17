import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';
import { PlaceholderPage } from './PlaceholderPage';
import { SellPage } from '../features/checkout/SellPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<SellPage />} />

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

          <Route
            path="caja"
            element={
              <PlaceholderPage
                title="Caja"
                phase="fases 2 y 3"
                description="Apertura, movimientos, arqueo y cierre de la sesión."
              />
            }
          />

          <Route
            path="mas"
            element={
              <PlaceholderPage
                title="Más"
                phase="fases 6 y 7"
                description="Catálogo, reportes, respaldo, auditoría y ajustes."
              />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
