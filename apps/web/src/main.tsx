import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initializeDatabase } from './db/db';
import './index.css';

initializeDatabase().catch((error: unknown) => {
  console.error('No se pudo inicializar la base local', error);
});

const container = document.getElementById('root');

if (!container) {
  throw new Error('No se encontró el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
