import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB, type Product } from '../db/db';
import { CatalogError, createProduct, listProducts } from './catalog';

describe('catálogo', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(() => {
    sequence += 1;
    database = new MarielDB(`mariel-catalog-test-${sequence}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('crea un producto disponible con nombre normalizado', async () => {
    const product = await createProduct(
      { name: '  Café   con Leche ', priceCents: 850 },
      database
    );

    expect(product.name).toBe('Café con Leche');
    expect(product.searchName).toBe('cafe con leche');
    expect(product.priceCents).toBe(850);
    expect(product.active).toBe(1);
    expect(product.available).toBe(1);
    expect(await listProducts(database)).toHaveLength(1);
  });

  it('no permite duplicar un producto activo', async () => {
    await createProduct({ name: 'Pan de queso', priceCents: 300 }, database);

    await expect(
      createProduct({ name: '  pan de QUESO ', priceCents: 400 }, database)
    ).rejects.toBeInstanceOf(CatalogError);
  });

  it('valida nombre y precio', async () => {
    await expect(createProduct({ name: '   ', priceCents: 300 }, database)).rejects.toThrow(
      'nombre'
    );
    await expect(createProduct({ name: '***', priceCents: 300 }, database)).rejects.toThrow(
      'letras o números'
    );
    await expect(createProduct({ name: 'Agua', priceCents: 0 }, database)).rejects.toThrow(
      'precio'
    );
    await expect(createProduct({ name: 'Agua', priceCents: 2.5 }, database)).rejects.toThrow(
      'precio'
    );
  });

  it('lista solo productos activos y disponibles', async () => {
    const base: Product = {
      id: 'p-1',
      name: 'Activo',
      searchName: 'activo',
      priceCents: 100,
      controlStock: 0,
      stock: 0,
      available: 1,
      sortOrder: 1,
      active: 1,
      createdAt: '2026-11-17T12:00:00.000Z',
      updatedAt: '2026-11-17T12:00:00.000Z'
    };

    await database.products.bulkAdd([
      base,
      { ...base, id: 'p-2', name: 'Inactivo', searchName: 'inactivo', active: 0, sortOrder: 2 },
      { ...base, id: 'p-3', name: 'Agotado', searchName: 'agotado', available: 0, sortOrder: 3 }
    ]);

    const products = await listProducts(database);
    expect(products.map((product) => product.id)).toEqual(['p-1']);
  });
});
