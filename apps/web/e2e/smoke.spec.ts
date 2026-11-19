import { expect, test } from '@playwright/test';

test('flujo diario completo: apertura, venta, cliente y cierre Z', async ({ page }) => {
  await page.goto('/');

  // 1. Abrir caja con Bs 100,00
  await page.getByRole('link', { name: /Caja/i }).first().click();
  await expect(page.getByText('La caja está cerrada.')).toBeVisible();

  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: '0', exact: true }).click();
  await page.getByRole('button', { name: '00', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir caja' }).click();

  await expect(page.getByText('Efectivo esperado')).toBeVisible();
  await expect(page.getByText('Bs 100,00').first()).toBeVisible();

  // 2. Ir a Vender, crear producto rápido "Empanada" a Bs 5,00 y cobrar con Bs 10,00
  await page.getByRole('link', { name: 'Vender' }).click();
  await page.getByRole('button', { name: /\+ Rápido/i }).click();
  await page.getByLabel(/Nombre/i).fill('Empanada');

  // En el teclado del producto rápido, ingresar 500 centavos (5,00)
  const quickDialog = page.getByRole('dialog');
  await quickDialog.getByRole('button', { name: '5', exact: true }).click();
  await quickDialog.getByRole('button', { name: '00', exact: true }).click();
  await quickDialog.getByRole('button', { name: /Guardar y agregar/i }).click();

  // Cobrar en efectivo con Bs 10,00
  await page.getByRole('button', { name: /Cobrar Bs 5,00/i }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: '0', exact: true }).click();
  await page.getByRole('button', { name: '00', exact: true }).click();
  await expect(page.getByText(/Cambio.*Bs 5,00/i)).toBeVisible();
  await page.getByRole('button', { name: /Cobrar Bs 5,00/i }).click();

  // 3. Ir a Clientes, crear "María" y depositar Bs 20,00 en efectivo
  await page.getByRole('link', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: '+ Nuevo' }).click();
  await page.getByLabel(/Nombre completo/i).fill('María');
  await page.getByRole('button', { name: 'Crear cliente' }).click();

  await page.getByRole('button', { name: '+ Depósito' }).click();
  const movDialog = page.getByRole('dialog', { name: /Depósito/i });
  await movDialog.getByRole('button', { name: '2', exact: true }).click();
  await movDialog.getByRole('button', { name: '0', exact: true }).click();
  await movDialog.getByRole('button', { name: '00', exact: true }).click();
  await movDialog.getByRole('button', { name: 'Confirmar depósito' }).click();
  await expect(page.getByText('Bs 20,00').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // 4. Volver a Caja: esperado debe ser Bs 125,00 (100 + 5 + 20) y cerrar Z cuadrado
  await page.getByRole('link', { name: /Caja/i }).first().click();
  await expect(page.getByText('Bs 125,00').first()).toBeVisible();

  await page.getByRole('button', { name: /Cerrar caja \(Arqueo Z\)/i }).click();
  const closeDialog = page.getByRole('dialog', { name: /Arqueo y cierre de caja/i });
  await closeDialog.getByRole('button', { name: 'Monto directo' }).click();
  await closeDialog.getByRole('button', { name: 'Usar esperado' }).click();
  await closeDialog.getByRole('button', { name: 'Confirmar cierre Z' }).click();

  await expect(page.getByText('Cierre Z completado')).toBeVisible();
  await expect(page.getByText(/Cuadrado/)).toBeVisible();
});
