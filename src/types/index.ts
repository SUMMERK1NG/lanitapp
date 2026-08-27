export type TransactionType = 'income' | 'expense';

export type SyncStatus = 'pending' | 'synced' | 'failed';

export type FortnightType = 'q1' | 'q2'; // q1 = Quincena 15, q2 = Quincena 30

export type PaymentMethodType = 'cash' | 'bcv_usd' | 'bcv_eur' | 'other';

export type DebtPlatformType = 'cashea' | 'creditotal' | 'multimax' | 'particular' | 'banco' | 'other';

export type DebtModeType = 'installments' | 'open'; // installments = Por Cuotas, open = Monto Fijo / Pago Abierto

export type SavingFrequency = 'fortnightly' | 'monthly'; // Quincenal (15 y 30) o Mensual

export type ThemeMode = 'navy' | 'dark' | 'emerald' | 'purple' | 'moca' | 'light';

export type AccentColor =
  | '#147DF0' // Azul Eléctrico
  | '#00C2C7' // Turquesa Neón
  | '#FF914D' // Naranja Vibrante
  | '#EC4899' // Rosa Magenta
  | '#8B5CF6' // Morado Eléctrico
  | '#10B981' // Verde Esmeralda
  | '#F59E0B' // Oro Ámbar
  | '#EF4444' // Rojo Coral
  | '#06B6D4' // Cian Hielo
  | '#14B8A6'; // Verde Menta

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  id: string;
  email?: string;
  cedula?: string;
  first_name?: string;
  last_name?: string;
  name: string;
  avatar: string; // emoji or image url/base64
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  currency: string;
  theme_mode: ThemeMode;
  accent_color: AccentColor;
  created_at?: string;
  last_sign_in_at?: string;
  last_login_at?: string;
  updated_at?: string;
  sync_status: SyncStatus;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  sync_status?: SyncStatus;
}

export type AccountType = 'cash' | 'bank' | 'digital' | 'savings' | 'credit' | 'other';

export interface Account {
  id: string;
  user_id?: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  color?: string;
  notes?: string;
  sync_status?: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  amount: number;
  type: TransactionType;
  description: string;
  category_id: string;
  account_id: string;
  transaction_date: string; // ISO format: YYYY-MM-DD
  sync_status: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface FixedIncome {
  id: string;
  user_id?: string;
  name: string;
  amount: number; // in USD
  original_amount?: number;
  currency: string;
  payment_mode?: FixedExpensePaymentMode;
  default_fortnight: 'q1' | 'q2' | 'both' | 'split'; // q1 = Quincena 15, q2 = Quincena 30, split = 50% en cada quincena, both = monto completo en ambas
  category_id: string;
  is_active: boolean;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
}

export interface MonthlyFixedIncomeOverride {
  id: string; // `${fixed_income_id}_${year}_${month}`
  fixed_income_id: string;
  year: number;
  month: number;
  is_active: boolean;
  custom_amount?: number;
  notes?: string;
  sync_status: SyncStatus;
}

export interface VariableIncome {
  id: string;
  user_id?: string;
  description: string;
  amount: number; // in USD
  original_amount?: number;
  payment_mode?: FixedExpensePaymentMode;
  year: number;
  month: number; // 0-11
  fortnight: FortnightType; // 'q1' (15) o 'q2' (30)
  category_id?: string;
  account_id?: string;
  transaction_id?: string;
  currency: string;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export type FixedExpensePaymentMode = 'usd_cash' | 'eur_cash' | 'ves_bcv' | 'ves_euro' | 'ves_parallel' | 'ves_fixed' | 'other' | 'cash' | 'bcv_usd' | 'fixed_ves' | 'bcv_eur' | 'parallel_ves';

export interface FixedExpense {
  id: string;
  user_id?: string;
  name: string;
  amount: number; // in USD equivalent for calculation
  amount_usd?: number; // in USD equivalent rounded
  original_amount?: number; // original amount entered in native currency
  amount_in_ves?: number; // legacy compatibility
  currency: 'USD' | 'VES' | 'EUR' | string;
  payment_mode?: FixedExpensePaymentMode;
  default_fortnight: 'q1' | 'q2' | 'both'; // q1 = Quincena 15, q2 = Quincena 30
  default_quincena?: number | null;
  quincena?: number | null;
  category_id: string;
  is_active: boolean; // default status
  assumed_by_third_party?: boolean;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
}

export interface MonthlyFixedOverride {
  id: string; // `${fixed_expense_id}_${year}_${month}`
  fixed_expense_id: string;
  year: number;
  month: number;
  is_active: boolean;
  custom_amount?: number;
  assumed_by_third_party?: boolean;
  notes?: string;
  sync_status: SyncStatus;
}

export interface VariableExpense {
  id: string;
  user_id?: string;
  description: string;
  amount: number; // in USD
  original_amount?: number;
  payment_mode?: FixedExpensePaymentMode;
  year: number;
  month: number; // 0-11
  fortnight: FortnightType; // 'q1' (15) o 'q2' (30)
  category_id?: string;
  account_id?: string;
  currency: string;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Debt {
  id: string;
  user_id?: string;
  creditor: string;
  creditor_name?: string;
  name?: string;
  platform?: DebtPlatformType;
  debt_mode: DebtModeType; // 'installments' (Cashea, etc.) vs 'open' (Monto Fijo / Abierto)
  total_amount: number;
  original_amount?: number;
  remaining_amount?: number;
  initial_payment?: number;
  current_balance: number;
  total_installments?: number;
  pending_installments?: number;
  installment_amount?: number; // cuota quincenal
  fortnight_due?: 'q1' | 'q2' | 'both';
  start_year?: number; // Año de inicio de pago
  start_month?: number; // Mes de inicio (0-11)
  start_fortnight?: FortnightType; // Quincena de inicio
  currency: 'USD' | 'EUR' | 'VES';
  currency_type?: string;
  payment_type: PaymentMethodType;
  payment_mode?: FixedExpensePaymentMode;
  has_interest?: boolean;
  interest_rate?: number; // percentage
  interest_amount?: number; // fixed interest amount in USD
  interest_frequency?: 'monthly' | 'fortnightly';
  interest_fortnight?: FortnightType;
  has_late_fee?: boolean;
  late_fee_amount?: number; // Penalización por cuota vencida o no pagada (ej. Cashea $4)
  due_date?: string;
  status: 'active' | 'paid';
  priority?: 'low' | 'medium' | 'high' | string;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DebtPayment {
  id: string;
  user_id?: string;
  debt_id: string;
  amount: number; // amount paid in debt currency
  amount_in_bs?: number;
  payment_date: string;
  year: number;
  month: number;
  fortnight: FortnightType;
  rate_applied?: number; // BCV rate on payment date
  parallel_rate?: number; // Market rate on payment date
  loss_differential?: number; // Differential in USD
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
}

export interface SavingsGoal {
  id: string;
  user_id?: string;
  name: string;
  target_amount: number; // in USD
  current_amount: number; // accumulated amount
  frequency: SavingFrequency; // 'fortnightly' (15 y 30) o 'monthly'
  target_fortnight?: 15 | 30 | null; // 15 o 30 para mensual, null para quincenal (ambas)
  amount_per_period: number; // Monto a apartar por quincena/mes
  suggested_amount?: number; // Monto sugerido por cuota
  start_date?: string; // Fecha de inicio (ISO format: YYYY-MM-DD)
  target_date?: string; // Fecha límite estimada (ISO format: YYYY-MM-DD)
  total_installments?: number; // Total de cuotas estimadas
  completed_installments?: number; // Total de cuotas completadas
  icon?: string;
  color?: string;
  status: 'active' | 'completed' | 'paused';
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SavingContribution {
  id: string;
  user_id?: string;
  goal_id: string;
  amount: number; // Monto aportado (0 si fue omitido)
  year: number;
  month: number;
  fortnight: FortnightType;
  is_skipped: boolean; // Si el usuario omitió este periodo por imprevisto
  contribution_date: string;
  notes?: string;
  sync_status: SyncStatus;
  created_at?: string;
}

export interface ExchangeRateItem {
  fuente: string;
  nombre: string;
  compra?: number;
  venta?: number;
  promedio: number;
  fechaActualizacion: string;
}

export interface ExchangeRatesData {
  bcvDollar: number;
  parallelDollar: number;
  bcvEuro: number;
  parallelEuro?: number;
  spreadPercentage: number;
  lastUpdated: string;
  raw?: any;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors?: string[];
  lastSyncTime?: string;
}

export type FortnightItemStatus = 'pending' | 'paid' | 'skipped';

export interface FortnightItemState {
  id: string; // `${item_type}_${item_id}_${period_key}`
  user_id?: string;
  item_id: string;
  item_type: 'fixed_expense' | 'expense' | 'debt';
  period_key: string; // 'YYYY-MM-15' | 'YYYY-MM-30'
  year: number;
  month: number;
  fortnight: FortnightType;
  status: FortnightItemStatus;
  amount?: number;
  transaction_id?: string;
  notes?: string;
  updated_at?: string;
  sync_status?: SyncStatus;
}

