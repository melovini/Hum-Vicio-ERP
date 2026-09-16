/**
 * Logger Operacional Estruturado (Frente 5.4 - Observabilidade e Diagnóstico)
 * Registra erros e eventos com identificadores da operação, garantindo
 * sanitização total de senhas, tokens, cartões e dados sensíveis.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  operation: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
}

const SENSITIVE_KEYS = new Set([
  'password', 'senha', 'token', 'authorization', 'secret', 
  'accesskey', 'secretkey', 'creditcard', 'cardnumber', 
  'cvv', 'hash', 'salt', 'pin'
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
  for (const sensitive of SENSITIVE_KEYS) {
    if (lowerKey.includes(sensitive)) {
      return '[REDACTED]';
    }
  }

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => sanitizeValue(key, item));
    }
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      cleanObj[k] = sanitizeValue(k, v);
    }
    return cleanObj;
  }

  // Mascara sequências de 13 a 19 dígitos (potenciais números de cartão)
  if (typeof value === 'string' && /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/.test(value)) {
    return value.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{1,4}\b/g, '****-****-****-****');
  }

  return value;
}

function createLogEntry(
  level: LogLevel, 
  operation: string, 
  details?: Record<string, unknown>, 
  err?: unknown
): LogEntry {
  const sanitizedDetails = details 
    ? (sanitizeValue('root', details) as Record<string, unknown>) 
    : undefined;

  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  if (err instanceof Error) {
    errorMessage = err.message;
    if (process.env.NODE_ENV !== 'production') {
      errorStack = err.stack;
    }
  } else if (typeof err === 'string') {
    errorMessage = err;
  }

  return {
    timestamp: new Date().toISOString(),
    level,
    operation,
    details: sanitizedDetails,
    errorMessage,
    errorStack,
  };
}

export const logger = {
  info(operation: string, details?: Record<string, unknown>): void {
    const entry = createLogEntry('info', operation, details);
    console.info(`[HUM-VICIO INFO] [${entry.operation}]`, entry.details || '');
  },

  warn(operation: string, details?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', operation, details);
    console.warn(`[HUM-VICIO WARN] [${entry.operation}]`, entry.details || '');
  },

  error(operation: string, err?: unknown, details?: Record<string, unknown>): void {
    const entry = createLogEntry('error', operation, details, err);
    console.error(`[HUM-VICIO ERROR] [${entry.operation}] ${entry.errorMessage || ''}`, entry.details || '');
  }
};
