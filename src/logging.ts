/**
 * Structured JSON Logging (FB-E3)
 *
 * Factory for pino-based structured logger.
 * Supports JSON and pretty output via FORMBRIDGE_LOG_FORMAT env var.
 */

import pino from 'pino';

export type LogFormat = 'json' | 'pretty';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  format?: LogFormat;
  level?: LogLevel;
  name?: string;
}

/**
 * Create a pino logger instance.
 *
 * Reads from env:
 *   FORMBRIDGE_LOG_FORMAT = json | pretty (default: pretty)
 *   FORMBRIDGE_LOG_LEVEL  = info | debug | warn | error (default: info)
 */
export function createLogger(options?: LoggerOptions): pino.Logger {
  const format = options?.format ?? (process.env['FORMBRIDGE_LOG_FORMAT'] as LogFormat) ?? 'pretty';
  const level = options?.level ?? (process.env['FORMBRIDGE_LOG_LEVEL'] as LogLevel) ?? 'info';

  const pinoOptions: pino.LoggerOptions = {
    level,
    name: options?.name ?? 'formbridge',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  if (format === 'pretty') {
    return pino({
      ...pinoOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(pinoOptions);
}

/** Singleton logger for the application */
let _logger: pino.Logger | undefined;

export function getLogger(): pino.Logger {
  if (!_logger) {
    _logger = createLogger();
  }
  return _logger;
}

/** Replace the global logger (useful for testing) */
export function setLogger(logger: pino.Logger): void {
  _logger = logger;
}

/** Create a child logger with additional bindings */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}
