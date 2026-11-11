import type { FortnightType } from '../types/index.ts';

/**
 * Formatea un objeto Date a 'YYYY-MM-DD' usando la hora local del dispositivo
 * (evita el desfase a UTC de `.toISOString().split('T')[0]`, crítico en UTC-4).
 */
export function getLocalTodayString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parsea una fecha 'YYYY-MM-DD' (o ISO con prefijo de fecha) en hora local
 * sin interpretar medianoche UTC (lo que resta 1 día en América).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const match = dateStr.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Extrae año, mes (1-12 y monthIndex 0-11) y día numéricos de forma segura desde 'YYYY-MM-DD'.
 */
export function getMonthYearFromDateStr(dateStr: string): {
  year: number;
  month: number;
  monthIndex: number;
  day: number;
} {
  const match = dateStr?.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const month = Number(match[2]);
    return {
      year: Number(match[1]),
      month,
      monthIndex: month - 1,
      day: Number(match[3]),
    };
  }
  const parsed = parseLocalDate(dateStr);
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    monthIndex: parsed.getMonth(),
    day: parsed.getDate(),
  };
}

/**
 * Devuelve la quincena correspondiente a una fecha local ('q1': días 1-15, 'q2': días 16+).
 */
export function getFortnightFromDate(date: Date = new Date()): FortnightType {
  return date.getDate() <= 15 ? 'q1' : 'q2';
}

/**
 * Clave canónica de período quincenal usada en fortnight_item_states (month es 0-11):
 * 'YYYY-MM-15' | 'YYYY-MM-30'
 */
export function getFortnightPeriodKey(
  year: number,
  monthZeroBased: number,
  fortnight: FortnightType
): string {
  const day = fortnight === 'q1' ? '15' : '30';
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${day}`;
}

/**
 * Devuelve una fecha calendario válida 'YYYY-MM-DD' para transacciones de una quincena
 * (monthZeroBased es 0-11; evita fechas inválidas como febrero-30 en PostgreSQL).
 */
export function getFortnightTransactionDate(
  year: number,
  monthZeroBased: number,
  fortnight: FortnightType
): string {
  if (fortnight === 'q1') {
    return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-15`;
  }
  const lastDayOfMonth = new Date(year, monthZeroBased + 1, 0).getDate();
  const safeDay = Math.min(30, lastDayOfMonth);
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/**
 * Calcula la quincena inmediatamente siguiente usando mes base 0 (0-11, como Date.getMonth()).
 */
export function getNextFortnightPeriod(
  year: number,
  monthZeroBased: number,
  fortnight: FortnightType
): { year: number; month: number; fortnight: FortnightType } {
  if (fortnight === 'q1') {
    return { year, month: monthZeroBased, fortnight: 'q2' };
  }
  if (monthZeroBased === 11) {
    return { year: year + 1, month: 0, fortnight: 'q1' };
  }
  return { year, month: monthZeroBased + 1, fortnight: 'q1' };
}

/**
 * Suma un número de meses (base 0: 0-11) devolviendo el nuevo año y month (0-11).
 */
export function addMonthsToYearMonth(
  year: number,
  monthZeroBased: number,
  offset: number
): { year: number; month: number } {
  const total = year * 12 + monthZeroBased + offset;
  const nextYear = Math.floor(total / 12);
  const nextMonth = ((total % 12) + 12) % 12;
  return { year: nextYear, month: nextMonth };
}
