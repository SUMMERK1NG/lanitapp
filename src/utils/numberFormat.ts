/**
 * Utilidades de cálculo y formateo numérico para Lanitapp
 */

/**
 * Formateador dinámico monetario sin bloqueo para inputs de montos.
 * Aplica separador de miles (.) en enteros y respeta hasta 2 decimales con (,).
 */
export function formatDynamicMoneyInput(raw: string): { displayValue: string; numericValue: number } {
  if (!raw) return { displayValue: '', numericValue: 0 };

  // Permitir solo números, puntos y comas
  const cleanRaw = raw.replace(/[^0-9.,]/g, '');
  if (!cleanRaw) return { displayValue: '', numericValue: 0 };

  // Normalizar coma a punto para cálculo numérico
  const normalized = cleanRaw.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized) || 0;

  // Si el usuario escribe números enteros, aplicar formato de miles con puntos
  // Si está escribiendo decimales (después de la coma o punto), respetar la entrada
  const parts = cleanRaw.split(/[,.]/);
  if (parts.length > 1) {
    const integerFormatted = parts[0].replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const decimals = parts[1].slice(0, 2);
    return {
      displayValue: `${integerFormatted},${decimals}`,
      numericValue: num,
    };
  } else {
    const integerFormatted = cleanRaw.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return {
      displayValue: integerFormatted,
      numericValue: num,
    };
  }
}

/**
 * Convierte de forma robusta cualquier valor ingresado por el usuario (con coma o punto) a número flotante estándar.
 */
export function parseCleanNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let s = val.toString().trim();
  if (!s) return 0;

  // Si contiene coma decimal (ej: "91.100,22" o "91100,22")
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Si tiene múltiples puntos de miles (ej: "91.100.000")
    const parts = s.split('.');
    if (parts.length > 2) {
      s = s.replace(/\./g, '');
    }
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Alias de compatibilidad
 */
export const parseVenezuelanNumber = parseCleanNumber;

/**
 * Formatea un número a moneda venezolana estricta (punto para miles, coma para decimales)
 */
export function formatCurrencyVE(val: number | undefined | null, minDecimals = 2, maxDecimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00';
  return val.toLocaleString('es-VE', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}
