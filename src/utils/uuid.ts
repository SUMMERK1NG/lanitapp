/**
 * Utilidades de validación y generación de UUID v4 estricto para Supabase / PostgreSQL 15
 */

export const isValidUuid = (id?: string | null): boolean => {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.trim());
};

export const generateUuid = (): string => {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
};

export const ensureValidUuid = (existingId?: string | null): string => {
  // Si existe y es un UUID válido estricto, lo retorna.
  if (existingId && isValidUuid(existingId)) {
    return existingId.trim();
  }
  // Si es un ID de plantilla (ej: "acc_cash", "cat_salary") o está corrupto, genera uno nuevo limpio.
  return generateUuid();
};

// Alias retrocompatible
export const ensureUuid = ensureValidUuid;
