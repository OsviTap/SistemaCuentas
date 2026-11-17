import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initializeDatabase } from './db/db';
import './index.css';

function getContainer(): HTMLElement {
  const element = document.getElementById('root');
  if (!element) {
    throw new Error('No se encontró el contenedor #root');
  }
  return element;
}

const container = getContainer();

async function bootstrap() {
  try {
    await initializeDatabase();
  } catch (error: unknown) {
    console.error('No se pudo inicializar la base local', error);
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
