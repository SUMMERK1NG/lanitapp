import type { Category, ExchangeRatesData } from '../types/index.ts';
import { formatCurrencyVE } from '../utils/numberFormat.ts';
import { isValidUuid } from '../utils/uuid.ts';

export const PALETTE_COLORS = [
  '#3B82F6', // Azul vibrante
  '#10B981', // Verde esmeralda
  '#F59E0B', // Ámbar dorado
  '#EC4899', // Rosa vibrante
  '#8B5CF6', // Violeta / Púrpura
  '#06B6D4', // Cyan eléctrico
  '#EF4444', // Rojo coral
  '#00C2C7', // Turquesa Lanitapp
  '#F97316', // Naranja brillante
  '#6366F1', // Índigo profundo
  '#84CC16', // Lima fresco
  '#64748B', // Pizarra / Gris neutro
];

export const DEFAULT_CATEGORY_COLOR_MAP: Record<string, string> = {
  // Gastos
  cat_housing: '#3B82F6',
  cat_food: '#10B981',
  cat_services: '#06B6D4',
  cat_transport: '#F59E0B',
  cat_debt: '#EF4444',
  cat_health: '#EC4899',
  cat_entertainment: '#8B5CF6',
  cat_savings: '#00C2C7',
  cat_other_exp: '#64748B',

  // Ingresos
  cat_salary: '#10B981',
  cat_bonus: '#00C2C7',
  cat_guard: '#6366F1',
  cat_tickets: '#F59E0B',
  cat_extras: '#EC4899',
};

export const DEFAULT_CATEGORY_COLOR_BY_NAME: Record<string, string> = {
  'vivienda y alquiler': '#3B82F6',
  'vivienda & alquiler': '#3B82F6',
  'comida y supermercado': '#10B981',
  'comida & supermercado': '#10B981',
  'servicios y fibra': '#06B6D4',
  'servicios & fibra': '#06B6D4',
  'transporte y gasolina': '#F59E0B',
  'transporte & gasolina': '#F59E0B',
  'pago de deudas y cuotas': '#EF4444',
  'pago de deudas & cuotas': '#EF4444',
  'pago de deudas': '#EF4444',
  deudas: '#EF4444',
  'salud y farmacia': '#EC4899',
  'salud & farmacia': '#EC4899',
  'ocio y salidas': '#8B5CF6',
  'ocio & salidas': '#8B5CF6',
  'ahorro y metas': '#00C2C7',
  'ahorro & metas': '#00C2C7',
  'otros gastos': '#64748B',
  'sueldo base': '#10B981',
  'plus y bonos': '#00C2C7',
  'plus & bonos': '#00C2C7',
  'guardias / turnos': '#6366F1',
  'tickets alimentación': '#F59E0B',
  'tickets alimentacion': '#F59E0B',
  'extras y freelance': '#EC4899',
  'extras & freelance': '#EC4899',
};

export const DEFAULT_CATEGORIES: Category[] = [
  // Gastos
  { id: 'cat_housing', code: 'cat_housing', name: 'Vivienda y Alquiler', type: 'expense', icon: 'Home', color: '#3B82F6', sync_status: 'synced' },
  { id: 'cat_food', code: 'cat_food', name: 'Comida y Supermercado', type: 'expense', icon: 'ShoppingCart', color: '#10B981', sync_status: 'synced' },
  { id: 'cat_services', code: 'cat_services', name: 'Servicios y Fibra', type: 'expense', icon: 'Wifi', color: '#06B6D4', sync_status: 'synced' },
  { id: 'cat_transport', code: 'cat_transport', name: 'Transporte y Gasolina', type: 'expense', icon: 'Car', color: '#F59E0B', sync_status: 'synced' },
  { id: 'cat_debt', code: 'cat_debt', name: 'Pago de Deudas y Cuotas', type: 'expense', icon: 'CreditCard', color: '#EF4444', sync_status: 'synced' },
  { id: 'cat_health', code: 'cat_health', name: 'Salud y Farmacia', type: 'expense', icon: 'HeartPulse', color: '#EC4899', sync_status: 'synced' },
  { id: 'cat_entertainment', code: 'cat_entertainment', name: 'Ocio y Salidas', type: 'expense', icon: 'Film', color: '#8B5CF6', sync_status: 'synced' },
  { id: 'cat_savings', code: 'cat_savings', name: 'Ahorro y Metas', type: 'expense', icon: 'PiggyBank', color: '#00C2C7', sync_status: 'synced' },
  { id: 'cat_other_exp', code: 'cat_other_exp', name: 'Otros Gastos', type: 'expense', icon: 'MoreHorizontal', color: '#64748B', sync_status: 'synced' },

  // Ingresos
  { id: 'cat_salary', code: 'cat_salary', name: 'Sueldo Base', type: 'income', icon: 'Briefcase', color: '#10B981', sync_status: 'synced' },
  { id: 'cat_bonus', code: 'cat_bonus', name: 'Plus y Bonos', type: 'income', icon: 'TrendingUp', color: '#00C2C7', sync_status: 'synced' },
  { id: 'cat_guard', code: 'cat_guard', name: 'Guardias / Turnos', type: 'income', icon: 'Clock', color: '#6366F1', sync_status: 'synced' },
  { id: 'cat_tickets', code: 'cat_tickets', name: 'Tickets Alimentación', type: 'income', icon: 'UtensilsCrossed', color: '#F59E0B', sync_status: 'synced' },
  { id: 'cat_extras', code: 'cat_extras', name: 'Extras y Freelance', type: 'income', icon: 'Laptop', color: '#EC4899', sync_status: 'synced' },
];

/**
 * Busca una categoría por UUID (id), código lógico (p. ej. 'cat_debt') o nombre normalizado.
 */
export function findCategory(
  categories: Category[],
  idOrCode?: string | null
): Category | undefined {
  if (!idOrCode) return undefined;
  const trimmed = idOrCode.trim();
  const normalized = trimmed.toLowerCase();
  return (
    categories.find((c) => c.id === trimmed) ||
    categories.find((c) => c.code === trimmed) ||
    categories.find((c) => c.name?.toLowerCase().trim() === normalized)
  );
}

/**
 * Resuelve un id o código ('cat_salary', UUID, etc.) a un UUID válido de categoría en BD.
 * Retorna null si aún no existe un UUID válido en BD (evita errores PostgreSQL 22P02 / 23503).
 */
export function resolveCategoryUuid(
  categories: Category[],
  idOrCode?: string | null
): string | null {
  if (!idOrCode) return null;
  const match = findCategory(categories, idOrCode);
  if (match && isValidUuid(match.id)) {
    return match.id;
  }
  return isValidUuid(idOrCode) ? idOrCode.trim() : null;
}

export function normalizeCurrencyCode(currency?: string | null): 'USD' | 'USDT' | 'VES' | 'EUR' {
  const normalized = (currency || 'USD').toUpperCase();
  if (normalized === 'BS' || normalized === 'VES') return 'VES';
  if (normalized === 'EUR') return 'EUR';
  if (normalized === 'USDT') return 'USDT';
  return 'USD';
}

export function getCurrencySymbol(currency?: string | null): string {
  const code = normalizeCurrencyCode(currency);
  if (code === 'VES') return 'Bs.';
  if (code === 'EUR') return '€';
  if (code === 'USDT') return 'USDT ';
  return '$';
}

export function formatMoneyByCurrency(amount: number, currency?: string | null): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${formatCurrencyVE(amount)}`;
}

/**
 * Convierte un monto en USD, USDT, EUR o VES a su equivalente en USD según las tasas vigentes.
 */
export function convertToUsd(
  amount: number,
  currency: string | undefined | null,
  rates: ExchangeRatesData,
  vesReference: 'bcv' | 'parallel' = 'bcv'
): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const code = normalizeCurrencyCode(currency);
  if (code === 'USD' || code === 'USDT') return amount;

  const usdRate =
    vesReference === 'parallel'
      ? rates.parallelDollar || rates.bcvDollar || 1
      : rates.bcvDollar || 1;

  if (code === 'VES') {
    return usdRate > 0 ? amount / usdRate : 0;
  }

  if (code === 'EUR') {
    const bcvUsd = rates.bcvDollar || 1;
    const bcvEur = rates.bcvEuro || bcvUsd;
    return bcvUsd > 0 ? amount * (bcvEur / bcvUsd) : amount;
  }

  return amount;
}
