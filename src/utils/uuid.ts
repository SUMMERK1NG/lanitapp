const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Genera un UUID v4 estándar válido RFC4122 para PostgreSQL
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Asegura que un ID tenga formato UUID v4 estricto para Supabase/PostgreSQL.
 * Si es nulo, vacío, o tiene formato inválido (ej. 'acc_cash', 'acc_123', 'vi_456'),
 * genera y retorna un UUID v4 nuevo y válido.
 */
export function ensureUuid(id?: string): string {
  if (!id) return generateUuid();
  const trimmed = id.trim();
  if (UUID_REGEX.test(trimmed)) return trimmed;

  // Si tiene un UUID válido embebido
  const match = trimmed.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  if (match && UUID_REGEX.test(match[0])) return match[0];

  return generateUuid();
}

export function isValidUuid(id?: string): boolean {
  return Boolean(id && UUID_REGEX.test(id.trim()));
}
