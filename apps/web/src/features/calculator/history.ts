import { db, type CalculatorEntry } from '../../db/db';
import { nowIso } from '../../lib/dates';
import { newId } from '../../lib/ids';

export const MAX_CALCULATOR_ENTRIES = 50;

export type NewCalculatorEntry = Pick<CalculatorEntry, 'expression' | 'result' | 'value'>;

/** Guarda un cálculo y recorta el historial a las últimas 50 entradas. */
export async function addCalculatorEntry(
  input: NewCalculatorEntry,
  database = db
): Promise<CalculatorEntry> {
  const entry: CalculatorEntry = {
    id: newId(),
    expression: input.expression,
    result: input.result,
    value: input.value,
    createdAt: nowIso()
  };

  await database.transaction('rw', database.calculatorEntries, async () => {
    await database.calculatorEntries.add(entry);

    const count = await database.calculatorEntries.count();
    if (count > MAX_CALCULATOR_ENTRIES) {
      const excess = await database.calculatorEntries
        .orderBy('createdAt')
        .limit(count - MAX_CALCULATOR_ENTRIES)
        .primaryKeys();
      await database.calculatorEntries.bulkDelete(excess);
    }
  });

  return entry;
}

/** Últimos cálculos, del más reciente al más antiguo. */
export async function listCalculatorEntries(
  database = db
): Promise<CalculatorEntry[]> {
  return database.calculatorEntries
    .orderBy('createdAt')
    .reverse()
    .limit(MAX_CALCULATOR_ENTRIES)
    .toArray();
}

export async function clearCalculatorEntries(database = db): Promise<void> {
  await database.calculatorEntries.clear();
}
