import { db, type MarielDB, type Product } from '../db/db';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';
import { MAX_AMOUNT_CENTS } from '../lib/money';
import { normalizeSearchName } from '../lib/search';

export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogError';
  }
}

export type CreateProductInput = {
  name: string;
  priceCents: number;
};

/** Crea un producto activo y disponible, listo para vender. */
export async function createProduct(
  input: CreateProductInput,
  database: MarielDB = db
): Promise<Product> {
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    throw new CatalogError('Escribe el nombre del producto.');
  }
  if (name.length > 60) {
    throw new CatalogError('El nombre no puede superar 60 caracteres.');
  }
  if (
    !Number.isInteger(input.priceCents) ||
    input.priceCents <= 0 ||
    input.priceCents > MAX_AMOUNT_CENTS
  ) {
    throw new CatalogError('Escribe un precio mayor que cero.');
  }

  const searchName = normalizeSearchName(name);
  if (searchName.length === 0) {
    throw new CatalogError('El nombre debe incluir letras o números.');
  }

  return database.transaction('rw', database.products, async () => {
    const matches = await database.products.where('searchName').equals(searchName).toArray();
    const activeMatch = matches.find((product) => product.active === 1);
    if (activeMatch) {
      throw new CatalogError(`Ya existe «${activeMatch.name}» en el catálogo.`);
    }

    const last = await database.products.orderBy('sortOrder').last();
    const timestamp = nowIso();
    const product: Product = {
      id: newId(),
      name,
      searchName,
      priceCents: input.priceCents,
      controlStock: 0,
      stock: 0,
      available: 1,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      active: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await database.products.add(product);
    return product;
  });
}

/** Productos activos y disponibles, en el orden del mostrador. */
export async function listProducts(database: MarielDB = db): Promise<Product[]> {
  const products = await database.products.where('active').equals(1).toArray();

  return products
    .filter((product) => product.available === 1)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
}
