import {
  db,
  readSetting,
  type CashSession,
  type Cents,
  type MarielDB
} from '../db/db';
import { formatDateTime } from '../lib/dates';
import { formatBs } from '../lib/money';

export type SessionReportData = {
  businessName: string;
  sessionNumber: string;
  openedAt: string;
  closedAt?: string;
  openingCashCents: Cents;
  openingQrCents: Cents;
  salesCount: number;
  voidedSalesCount: number;
  salesCents: Cents;
  cashSalesCents: Cents;
  qrSalesCents: Cents;
  expensesCashCents: Cents;
  expensesQrCents: Cents;
  ownerWithdrawalsCashCents: Cents;
  ownerWithdrawalsQrCents: Cents;
  clientDepositsCashCents: Cents;
  clientDepositsQrCents: Cents;
  clientWithdrawalsCashCents: Cents;
  clientWithdrawalsQrCents: Cents;
  adjustmentsCashCents: Cents;
  adjustmentsQrCents: Cents;
  expectedCashCents: Cents;
  expectedQrCents: Cents;
};

/**
 * Reúne los totales de una sesión desde el libro de caja (`cashMovements`) y `sales`.
 * Funciona tanto dentro como fuera de una transacción de Dexie.
 */
export async function getSessionReportData(
  session: Pick<
    CashSession,
    'id' | 'number' | 'openedAt' | 'closedAt' | 'openingCashCents' | 'openingQrCents'
  >,
  database: MarielDB = db
): Promise<SessionReportData> {
  const [movements, sales, businessName] = await Promise.all([
    database.cashMovements.where('sessionId').equals(session.id).toArray(),
    database.sales.where('sessionId').equals(session.id).toArray(),
    readSetting('businessName', database)
  ]);

  let cashNetCents = 0;
  let qrNetCents = 0;
  let cashSalesCents = 0;
  let qrSalesCents = 0;
  let expensesCashCents = 0;
  let expensesQrCents = 0;
  let ownerWithdrawalsCashCents = 0;
  let ownerWithdrawalsQrCents = 0;
  let clientDepositsCashCents = 0;
  let clientDepositsQrCents = 0;
  let clientWithdrawalsCashCents = 0;
  let clientWithdrawalsQrCents = 0;
  let adjustmentsCashCents = 0;
  let adjustmentsQrCents = 0;

  for (const movement of movements) {
    const isCash = movement.medium === 'cash';
    if (isCash) {
      cashNetCents += movement.amountCents;
    } else {
      qrNetCents += movement.amountCents;
    }

    switch (movement.type) {
      case 'sale':
        if (isCash) cashSalesCents += movement.amountCents;
        else qrSalesCents += movement.amountCents;
        break;
      case 'expense':
        if (isCash) expensesCashCents += Math.abs(movement.amountCents);
        else expensesQrCents += Math.abs(movement.amountCents);
        break;
      case 'owner_withdrawal':
        if (isCash) ownerWithdrawalsCashCents += Math.abs(movement.amountCents);
        else ownerWithdrawalsQrCents += Math.abs(movement.amountCents);
        break;
      case 'client_deposit':
        if (isCash) clientDepositsCashCents += movement.amountCents;
        else clientDepositsQrCents += movement.amountCents;
        break;
      case 'client_withdrawal':
        if (isCash) clientWithdrawalsCashCents += Math.abs(movement.amountCents);
        else clientWithdrawalsQrCents += Math.abs(movement.amountCents);
        break;
      case 'adjustment':
      case 'reversal':
        if (isCash) adjustmentsCashCents += movement.amountCents;
        else adjustmentsQrCents += movement.amountCents;
        break;
      case 'service_remittance':
        if (isCash) expensesCashCents += Math.abs(movement.amountCents);
        else expensesQrCents += Math.abs(movement.amountCents);
        break;
    }
  }

  const completedSales = sales.filter((sale) => sale.status === 'completed');
  const voidedSalesCount = sales.filter((sale) => sale.status === 'voided').length;

  return {
    businessName: businessName.trim() || 'Sistema Mariel',
    sessionNumber: session.number,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openingCashCents: session.openingCashCents,
    openingQrCents: session.openingQrCents,
    salesCount: completedSales.length,
    voidedSalesCount,
    salesCents: completedSales.reduce((sum, sale) => sum + sale.totalCents, 0),
    cashSalesCents,
    qrSalesCents,
    expensesCashCents,
    expensesQrCents,
    ownerWithdrawalsCashCents,
    ownerWithdrawalsQrCents,
    clientDepositsCashCents,
    clientDepositsQrCents,
    clientWithdrawalsCashCents,
    clientWithdrawalsQrCents,
    adjustmentsCashCents,
    adjustmentsQrCents,
    expectedCashCents: session.openingCashCents + cashNetCents,
    expectedQrCents: session.openingQrCents + qrNetCents
  };
}

export type CashReportOptions =
  | { kind: 'X'; generatedAt: string }
  | {
      kind: 'Z';
      closedAt: string;
      countedCashCents: Cents;
      countedQrCents: Cents;
      closingNotes?: string;
    };

function formatDifference(diffCents: Cents): string {
  if (diffCents === 0) return `${formatBs(0)} (Cuadrado)`;
  if (diffCents > 0) return `+${formatBs(diffCents)} (Sobrante)`;
  return `${formatBs(diffCents)} (Faltante)`;
}

/** Genera el texto legible del cierre X o Z para ver en pantalla o compartir por WhatsApp. */
export function formatCashReportText(
  data: SessionReportData,
  options: CashReportOptions
): string {
  const title = options.kind === 'Z' ? 'CIERRE Z (DEFINITIVO)' : 'REPORTE X (PARCIAL)';
  const lines: string[] = [
    `*${data.businessName}*`,
    `*${title}* · Sesión ${data.sessionNumber}`,
    `Apertura: ${formatDateTime(data.openedAt)}`,
    options.kind === 'Z'
      ? `Cierre: ${formatDateTime(options.closedAt)}`
      : `Corte: ${formatDateTime(options.generatedAt)}`,
    '',
    '*Ventas*',
    `- Cantidad: ${data.salesCount}`,
    `- Total vendido: ${formatBs(data.salesCents)}`,
    `- Efectivo: ${formatBs(data.cashSalesCents)}`,
    `- QR: ${formatBs(data.qrSalesCents)}`
  ];

  if (data.voidedSalesCount > 0) {
    lines.push(`- Anuladas: ${data.voidedSalesCount}`);
  }

  const totalExpenses = data.expensesCashCents + data.expensesQrCents;
  const totalWithdrawals = data.ownerWithdrawalsCashCents + data.ownerWithdrawalsQrCents;
  const totalClientDeposits = data.clientDepositsCashCents + data.clientDepositsQrCents;
  const totalClientWithdrawals =
    data.clientWithdrawalsCashCents + data.clientWithdrawalsQrCents;
  const totalAdjustments = data.adjustmentsCashCents + data.adjustmentsQrCents;

  if (
    totalExpenses > 0 ||
    totalWithdrawals > 0 ||
    totalClientDeposits > 0 ||
    totalClientWithdrawals > 0 ||
    totalAdjustments !== 0
  ) {
    lines.push('', '*Otros movimientos*');
    if (totalExpenses > 0) {
      lines.push(`- Gastos/Salidas: ${formatBs(totalExpenses)}`);
    }
    if (totalWithdrawals > 0) {
      lines.push(`- Retiros dueña: ${formatBs(totalWithdrawals)}`);
    }
    if (totalClientDeposits > 0) {
      lines.push(`- Depósitos clientes: ${formatBs(totalClientDeposits)}`);
    }
    if (totalClientWithdrawals > 0) {
      lines.push(`- Retiros clientes: ${formatBs(totalClientWithdrawals)}`);
    }
    if (totalAdjustments !== 0) {
      lines.push(`- Ajustes/Reversos: ${formatBs(totalAdjustments)}`);
    }
  }

  lines.push(
    '',
    '*Caja*',
    `- Efectivo inicial: ${formatBs(data.openingCashCents)}`,
    `- Efectivo esperado: ${formatBs(data.expectedCashCents)}`
  );

  if (options.kind === 'Z') {
    const diffCash = options.countedCashCents - data.expectedCashCents;
    const diffQr = options.countedQrCents - data.expectedQrCents;

    lines.push(
      `- Efectivo contado: ${formatBs(options.countedCashCents)}`,
      `- Dif. efectivo: ${formatDifference(diffCash)}`,
      `- QR esperado: ${formatBs(data.expectedQrCents)}`,
      `- QR contado: ${formatBs(options.countedQrCents)}`,
      `- Dif. QR: ${formatDifference(diffQr)}`
    );

    if (options.closingNotes?.trim()) {
      lines.push('', `*Nota:* ${options.closingNotes.trim()}`);
    }
  } else {
    lines.push(`- QR esperado: ${formatBs(data.expectedQrCents)}`);
  }

  return lines.join('\n');
}

