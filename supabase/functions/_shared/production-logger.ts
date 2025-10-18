/**
 * Production-ready logging system for Edge Functions
 * 
 * Security features:
 * - No sensitive data logging in production
 * - Configurable log levels
 * - Automatic PII redaction
 */

const isProd = () => Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
const isDebugMode = () => Deno.env.get("DEBUG") === "true";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

/**
 * Redacts sensitive information from log context
 */
function redactSensitive(context: LogContext): LogContext {
  const sensitiveKeys = [
    'email',
    'password',
    'token',
    'secret',
    'api_key',
    'apikey',
    'stripe_key',
    'phone',
    'address',
    'ip_address'
  ];

  const redacted = { ...context };
  
  for (const [key, value] of Object.entries(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      if (typeof value === 'string') {
        // Keep first and last 2 chars for debugging, redact middle
        redacted[key] = value.length > 4 
          ? `${value.slice(0, 2)}***${value.slice(-2)}`
          : '***';
      } else {
        redacted[key] = '[REDACTED]';
      }
    }
  }
  
  return redacted;
}

/**
 * Format log message with timestamp and level
 */
function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(redactSensitive(context))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Production-ready logger
 */
export const logger = {
  /**
   * Debug logs - only in development or debug mode
   */
  debug: (message: string, context?: LogContext) => {
    if (!isProd() || isDebugMode()) {
      console.log(formatMessage('debug', message, context));
    }
  },

  /**
   * Info logs - minimal in production
   */
  info: (message: string, context?: LogContext) => {
    if (!isProd()) {
      console.log(formatMessage('info', message, context));
    } else if (isDebugMode()) {
      console.log(formatMessage('info', message, context));
    }
  },

  /**
   * Warning logs - always logged
   */
  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error logs - always logged with full context
   */
  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : String(error)
    };
    console.error(formatMessage('error', message, errorContext));
  },

  /**
   * Log function execution time
   */
  time: (label: string) => {
    if (!isProd() || isDebugMode()) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (!isProd() || isDebugMode()) {
      console.timeEnd(label);
    }
  }
};
