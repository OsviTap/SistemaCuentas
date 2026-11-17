import type { AccountMovementType, CashMovementType, SalePaymentMethod } from '../db/db';

export const CASH_MOVEMENT_LABELS: Record<CashMovementType, string> = {
  sale: 'Venta',
  client_deposit: 'Depósito de cliente',
  client_withdrawal: 'Retiro de cliente',
  expense: 'Gasto',
  owner_withdrawal: 'Retiro de la dueña',
  service_remittance: 'Remesa de servicio',
  adjustment: 'Ajuste',
  reversal: 'Reverso'
};

export const ACCOUNT_MOVEMENT_LABELS: Record<AccountMovementType, string> = {
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  sale_payment: 'Pago de venta',
  service_payment: 'Pago de servicio',
  adjustment: 'Ajuste',
  transfer_in: 'Transferencia recibida',
  transfer_out: 'Transferencia enviada',
  reversal: 'Reverso'
};

export const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  cash: 'Efectivo',
  qr: 'QR',
  account: 'Saldo de cliente'
};
