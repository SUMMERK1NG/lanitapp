// Sistema de logging seguro que SOLO funciona en desarrollo local
const isDevelopment = Boolean(import.meta.env.DEV);

// En producción (lanitapp.xyz), suprimir console.log/info/warn globalmente y sanitizar console.error
if (!isDevelopment && typeof window !== 'undefined') {
  window.console.log = () => {};
  window.console.info = () => {};
  window.console.debug = () => {};
  window.console.warn = () => {};
  window.console.table = () => {};
  window.console.group = () => {};
  window.console.groupEnd = () => {};
  const originalError = window.console.error;
  window.console.error = (...args: any[]) => {
    const sanitized = args.map((arg) => {
      if (arg instanceof Error) return arg.message;
      if (typeof arg === 'string') return arg;
      return '[Protected Data]';
    });
    originalError.apply(console, ['[LANITAPP]:', ...sanitized]);
  };
}

export interface Logger {
  dev: (...args: any[]) => void;
  error: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  table: (data: any) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

export const logger: Logger = {
  // Solo loguea en desarrollo (localhost)
  dev: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Errores críticos SIEMPRE se loguean (pero sin datos sensibles en producción)
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      const sanitized = args.map((arg) => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'string') return arg;
        return '[Protected Data]';
      });
      console.error('[LANITAPP Error]:', ...sanitized);
    }
  },

  // Solo loguea en desarrollo
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  // Solo loguea en desarrollo
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  // Tabla (solo en desarrollo)
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  // Agrupar logs (solo en desarrollo)
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  // Cerrar grupo (solo en desarrollo)
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
};
