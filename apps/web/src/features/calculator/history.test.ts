import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarielDB } from '../../db/db';
import {
  MAX_CALCULATOR_ENTRIES,
  addCalculatorEntry,
  clearCalculatorEntries,
  listCalculatorEntries
} from './history';

describe('historial de la calculadora', () => {
  let database: MarielDB;
  let sequence = 0;

  beforeEach(() => {
    sequence += 1;
    database = new MarielDB(`mariel-calc-test-${sequence}`);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('guarda los cálculos y los lista del más reciente al más antiguo', async () => {
    await addCalculatorEntry({ expression: '1 + 1 =', result: '2', value: '2' }, database);
    await addCalculatorEntry({ expression: '2 + 2 =', result: '4', value: '4' }, database);

    const entries = await listCalculatorEntries(database);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.value).toBe('4');
    expect(entries[1]?.value).toBe('2');
  });

  it(`conserva como máximo ${MAX_CALCULATOR_ENTRIES} entradas`, async () => {
    for (let index = 0; index < MAX_CALCULATOR_ENTRIES + 1; index += 1) {
      await addCalculatorEntry(
        { expression: `${index} + 0 =`, result: String(index), value: String(index) },
        database
      );
    }

    const entries = await listCalculatorEntries(database);
    expect(entries).toHaveLength(MAX_CALCULATOR_ENTRIES);
    expect(entries.some((entry) => entry.value === '0')).toBe(false);
  });

  it('borra todo el historial', async () => {
    await addCalculatorEntry({ expression: '3 × 3 =', result: '9', value: '9' }, database);
    await clearCalculatorEntries(database);
    expect(await listCalculatorEntries(database)).toHaveLength(0);
  });
});
