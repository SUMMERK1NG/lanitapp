/**
 * Almacén en memoria para mensajes flash de autenticación (sin usar sessionStorage/localStorage).
 */
let _authFlashError: string | null = null;

export function setAuthFlashError(message: string | null): void {
  _authFlashError = message;
}

export function getAuthFlashError(): string | null {
  return _authFlashError;
}

export function consumeAuthFlashError(): string | null {
  const msg = _authFlashError;
  _authFlashError = null;
  return msg;
}
