import Dexie, { type Table } from 'dexie';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';

/**
 * Base operativa local. Dexie/IndexedDB es la fuente de verdad del negocio.
 * Supabase no participa en esta capa: solo recibe respaldos cifrados.
 */

export type Id = string;
export type Cents = number;
export type IsoDateTime = string;
export type Flag = 0 | 1;

export const SCHEMA_VERSION = 2;

/**
 * Operadora local única. La app todavía no tiene inicio de sesión; este
 * identificador se usa para auditoría y luego se reemplaza por el usuario real.
 */
export const LOCAL_OWNER_ID = 'local-owner';

// ---------------------------------------------------------------------------
// Configuración y usuarios
// ---------------------------------------------------------------------------

export type AppSettings = {
  businessName: string;
  businessSubtitle: string;
  currency: 'BOB';
  locale: 'es-BO';
  allowNegativeBalance: boolean;
  pinMaxAttempts: number;
  backupRetentionQuick: number;
  backupRetentionFull: number;
  qrOwnerName: string;
  /** Identificador local del teléfono, para auditoría. */
  deviceId: string;
  /** Adjunto de la imagen del QR de cobro; vacío si no se cargó. */
  qrImageAttachmentId: string;
};

export type SettingKey = keyof AppSettings;
export type SettingValue = AppSettings[SettingKey];

export type Setting = {
  key: SettingKey;
  value: SettingValue;
  updatedAt: IsoDateTime;
};

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: '',
  businessSubtitle: '',
  currency: 'BOB',
  locale: 'es-BO',
  allowNegativeBalance: false,
  pinMaxAttempts: 5,
  backupRetentionQuick: 14,
  backupRetentionFull: 7,
  qrOwnerName: '',
  deviceId: '',
  qrImageAttachmentId: ''
};

export type UserRole = 'owner' | 'supervisor';

export type User = {
  id: Id;
  name: string;
  role: UserRole;
  /** Hash del PIN; nunca se guarda el PIN en claro. */
  pinHash: string;
  pinSalt: string;
  pinIterations: number;
  active: Flag;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastLoginAt?: IsoDateTime;
};

// ---------------------------------------------------------------------------
// Clientes y cuentas
// ---------------------------------------------------------------------------

export type Client = {
  id: Id;
  name: string;
  /** Nombre normalizado para búsqueda sin acentos ni mayúsculas. */
  searchName: string;
  phone?: string;
  alias?: string;
  notes?: string;
  /** Caché del saldo. La fuente de verdad es accountMovements. */
  balanceCents: Cents;
  active: Flag;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type AccountMovementType =
  | 'deposit'
  | 'withdrawal'
  | 'sale_payment'
  | 'service_payment'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'reversal';

export type PaymentMedium = 'cash' | 'qr' | 'mixed' | 'internal';

export type AccountMovement = {
  id: Id;
  clientId: Id;
  sessionId?: Id;
  saleId?: Id;
  type: AccountMovementType;
  /** Firmado: positivo entra al cliente, negativo sale. */
  amountCents: Cents;
  /** Parte en efectivo, firmada. */
  cashCents: Cents;
  /** Parte por QR, firmada. */
  qrCents: Cents;
  balanceAfterCents: Cents;
  method: PaymentMedium;
  qrReference?: string;
  groupId?: string;
  description?: string;
  /** Evita duplicados por doble toque o reintento. */
  idempotencyKey: string;
  createdBy: Id;
  createdAt: IsoDateTime;
  reversalOf?: Id;
  reversedBy?: Id;
  authorizedBy?: Id;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export type Product = {
  id: Id;
  name: string;
  searchName: string;
  priceCents: Cents;
  category?: string;
  controlStock: Flag;
  stock: number;
  available: Flag;
  sortOrder: number;
  active: Flag;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type Service = {
  id: Id;
  name: string;
  providerName: string;
  searchName: string;
  /** Comisión fija en centavos. */
  commissionFixedCents: Cents;
  /** Comisión variable en puntos base (0–10000). */
  commissionBps: number;
  /** Monto fijo del servicio, si aplica. */
  fixedAmountCents?: Cents;
  requiresSupplyNumber: Flag;
  sortOrder: number;
  active: Flag;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

// ---------------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------------

export type CashSessionStatus = 'open' | 'closed';

export type CashSession = {
  id: Id;
  /** Folio legible: 2026-0001. */
  number: string;
  status: CashSessionStatus;
  openedBy: Id;
  openedAt: IsoDateTime;
  openingCashCents: Cents;
  openingQrCents: Cents;
  openingNotes?: string;
  closedBy?: Id;
  closedAt?: IsoDateTime;
  expectedCashCents?: Cents;
  countedCashCents?: Cents;
  differenceCashCents?: Cents;
  expectedQrCents?: Cents;
  countedQrCents?: Cents;
  differenceQrCents?: Cents;
  closingNotes?: string;
  /** Snapshot del reporte Z congelado al cerrar. */
  reportZText?: string;
  authorizedBy?: Id;
  deviceId?: string;
};

export type CashDenominationPhase = 'opening' | 'closing';
export type CashDenominationType = 'bill' | 'coin';

export type CashDenomination = {
  id: Id;
  sessionId: Id;
  phase: CashDenominationPhase;
  type: CashDenominationType;
  valueCents: Cents;
  count: number;
  subtotalCents: Cents;
};

export type CashMovementMedium = 'cash' | 'qr';

export type CashMovementType =
  | 'sale'
  | 'client_deposit'
  | 'client_withdrawal'
  | 'expense'
  | 'owner_withdrawal'
  | 'service_remittance'
  | 'adjustment'
  | 'reversal';

export type CashMovement = {
  id: Id;
  sessionId: Id;
  medium: CashMovementMedium;
  type: CashMovementType;
  /** Firmado: positivo entra a caja, negativo sale. */
  amountCents: Cents;
  saleId?: Id;
  salePaymentId?: Id;
  accountMovementId?: Id;
  expenseId?: Id;
  remittanceId?: Id;
  description?: string;
  idempotencyKey?: string;
  createdBy: Id;
  createdAt: IsoDateTime;
  reversalOf?: Id;
  reversedBy?: Id;
  authorizedBy?: Id;
};

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export type SaleStatus = 'completed' | 'voided';

export type Sale = {
  id: Id;
  /** Folio secuencial único generado en el teléfono. */
  folio: string;
  sessionId: Id;
  clientId?: Id;
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  status: SaleStatus;
  notes?: string;
  idempotencyKey: string;
  createdBy: Id;
  createdAt: IsoDateTime;
  voidedAt?: IsoDateTime;
  voidedBy?: Id;
  voidReason?: string;
  authorizedBy?: Id;
};

export type SaleItemKind = 'product' | 'service';

export type SaleItem = {
  id: Id;
  saleId: Id;
  kind: SaleItemKind;
  productId?: Id;
  serviceId?: Id;
  /** Copia del nombre al momento de la venta. */
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  discountCents: Cents;
  subtotalCents: Cents;
  /** Monto que pertenece a la empresa del servicio. */
  serviceAmountCents?: Cents;
  commissionCents?: Cents;
  providerName?: string;
  supplyNumber?: string;
  remittanceId?: Id;
  remittedAt?: IsoDateTime;
};

export type SalePaymentMethod = 'cash' | 'qr' | 'account';

export type SalePayment = {
  id: Id;
  saleId: Id;
  method: SalePaymentMethod;
  amountCents: Cents;
  cashReceivedCents?: Cents;
  changeCents?: Cents;
  qrReference?: string;
  attachmentId?: Id;
  /** Obligatorio cuando method = 'account'. */
  clientId?: Id;
  createdAt: IsoDateTime;
};

// ---------------------------------------------------------------------------
// Gastos, remesas y auditoría
// ---------------------------------------------------------------------------

export type ExpenseKind = 'expense' | 'owner_withdrawal';

export type Expense = {
  id: Id;
  sessionId: Id;
  movementId: Id;
  kind: ExpenseKind;
  category: string;
  description: string;
  amountCents: Cents;
  medium: CashMovementMedium;
  attachmentId?: Id;
  createdBy: Id;
  createdAt: IsoDateTime;
  reversedBy?: Id;
  authorizedBy?: Id;
};

export type ServiceRemittance = {
  id: Id;
  providerName: string;
  sessionId: Id;
  movementId: Id;
  amountCents: Cents;
  notes?: string;
  createdBy: Id;
  createdAt: IsoDateTime;
};

export type AuditLog = {
  id: Id;
  actorId: Id;
  authorizedBy?: Id;
  /** Acción legible y estable, por ejemplo 'sale.void'. */
  action: string;
  entity: string;
  entityId: Id;
  sessionId?: Id;
  before?: unknown;
  after?: unknown;
  reason?: string;
  deviceId: string;
  createdAt: IsoDateTime;
};

// ---------------------------------------------------------------------------
// Adjuntos, borradores y estado del respaldo
// ---------------------------------------------------------------------------

export type AttachmentOwnerType =
  | 'sale_payment'
  | 'expense'
  | 'client_movement'
  | 'business_qr';

export type Attachment = {
  id: Id;
  ownerType: AttachmentOwnerType;
  ownerId: Id;
  mimeType: string;
  width?: number;
  height?: number;
  size: number;
  /** Imagen comprimida; puede contener datos bancarios. */
  blob: Blob;
  createdAt: IsoDateTime;
};

export type CheckoutDraftItem = {
  productId?: Id;
  serviceId?: Id;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
};

export type CheckoutDraft = {
  id: string;
  sessionId?: Id;
  clientId?: Id;
  items: CheckoutDraftItem[];
  method?: SalePaymentMethod;
  cashReceivedCents?: Cents;
  qrReference?: string;
  notes?: string;
  updatedAt: IsoDateTime;
};

export const COUNTER_NAMES = ['saleFolio', 'cashSessionNumber'] as const;
export type CounterName = (typeof COUNTER_NAMES)[number];

export type Counter = {
  name: CounterName;
  value: number;
};

export type BackupState = {
  key: string;
  value: unknown;
  updatedAt: IsoDateTime;
};

/**
 * Historial de la calculadora rápida. No participa en ventas ni en caja:
 * es una utilidad de consulta para la operadora.
 */
export type CalculatorEntry = {
  id: Id;
  /** Expresión legible, por ejemplo "12,50 × 3 =". */
  expression: string;
  /** Resultado legible con formato boliviano, por ejemplo "37,50". */
  result: string;
  /** Valor canónico con punto decimal, para reutilizarlo. */
  value: string;
  createdAt: IsoDateTime;
};

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

export class MarielDB extends Dexie {
  settings!: Table<Setting, SettingKey>;
  users!: Table<User, Id>;
  clients!: Table<Client, Id>;
  accountMovements!: Table<AccountMovement, Id>;
  products!: Table<Product, Id>;
  services!: Table<Service, Id>;
  cashSessions!: Table<CashSession, Id>;
  cashDenominations!: Table<CashDenomination, Id>;
  cashMovements!: Table<CashMovement, Id>;
  sales!: Table<Sale, Id>;
  saleItems!: Table<SaleItem, Id>;
  salePayments!: Table<SalePayment, Id>;
  expenses!: Table<Expense, Id>;
  serviceRemittances!: Table<ServiceRemittance, Id>;
  auditLogs!: Table<AuditLog, Id>;
  attachments!: Table<Attachment, Id>;
  checkoutDrafts!: Table<CheckoutDraft, string>;
  counters!: Table<Counter, CounterName>;
  backupState!: Table<BackupState, string>;
  calculatorEntries!: Table<CalculatorEntry, Id>;

  constructor(name = 'mariel') {
    super(name);

    this.version(SCHEMA_VERSION).stores({
      settings: 'key',
      users: 'id, role, active',
      clients: 'id, searchName, phone, active, updatedAt',
      accountMovements:
        'id, &idempotencyKey, clientId, [clientId+createdAt], sessionId, saleId, type, createdAt, reversalOf',
      products: 'id, searchName, active, available, updatedAt, sortOrder',
      services: 'id, searchName, providerName, active, updatedAt, sortOrder',
      cashSessions: 'id, &number, status, openedAt, closedAt',
      cashDenominations: 'id, sessionId, [sessionId+phase], phase, valueCents',
      cashMovements:
        'id, sessionId, [sessionId+medium], [sessionId+createdAt], medium, type, createdAt, saleId, salePaymentId, accountMovementId, expenseId, remittanceId, reversalOf',
      sales:
        'id, &folio, &idempotencyKey, sessionId, [sessionId+createdAt], clientId, createdAt, status',
      saleItems: 'id, saleId, [saleId+kind], productId, serviceId, remittanceId',
      salePayments: 'id, saleId, [saleId+method], method, qrReference, clientId, createdAt',
      expenses: 'id, sessionId, movementId, kind, createdAt',
      serviceRemittances: 'id, providerName, sessionId, createdAt',
      auditLogs: 'id, createdAt, entity, [entity+entityId], action, actorId, sessionId',
      attachments: 'id, ownerType, [ownerType+ownerId], createdAt',
      checkoutDrafts: 'id, updatedAt',
      counters: 'name',
      backupState: 'key'
    });

    // v2: calculadora rápida con historial local.
    this.version(2).stores({
      calculatorEntries: 'id, createdAt'
    });
  }
}

export const db = new MarielDB();

/**
 * Crea la configuración y los contadores iniciales si faltan.
 * Es idempotente: se puede ejecutar en cada arranque.
 */
export async function initializeDatabase(database: MarielDB = db): Promise<void> {
  const timestamp = nowIso();

  await database.transaction(
    'rw',
    database.settings,
    database.counters,
    database.users,
    async () => {
      for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
        const existing = await database.settings.get(key);
        if (!existing) {
          await database.settings.put({
            key,
            value: DEFAULT_SETTINGS[key],
            updatedAt: timestamp
          });
        }
      }

      const device = await database.settings.get('deviceId');
      if (!device || device.value === '') {
        await database.settings.put({
          key: 'deviceId',
          value: newId(),
          updatedAt: timestamp
        });
      }

      for (const name of COUNTER_NAMES) {
        const existing = await database.counters.get(name);
        if (!existing) {
          await database.counters.put({ name, value: 0 });
        }
      }

      if ((await database.users.count()) === 0) {
        await database.users.put({
          id: LOCAL_OWNER_ID,
          name: 'Dueña',
          role: 'owner',
          // Sin PIN configurado todavía. No hay inicio de sesión en esta fase.
          pinHash: '',
          pinSalt: '',
          pinIterations: 0,
          active: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }
  );
}

/** Escribe una configuración con la fecha actual. */
export async function writeSetting<K extends SettingKey>(
  key: K,
  value: AppSettings[K],
  database: MarielDB = db
): Promise<void> {
  await database.settings.put({ key, value, updatedAt: nowIso() });
}

/** Lee una configuración con su valor por defecto. */
export async function readSetting<K extends SettingKey>(
  key: K,
  database: MarielDB = db
): Promise<AppSettings[K]> {
  const setting = await database.settings.get(key);
  return (setting ? setting.value : DEFAULT_SETTINGS[key]) as AppSettings[K];
}
