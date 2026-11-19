import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { env } from "../config/env.js";

/**
 * AsyncLocalStorage context to store request correlation IDs across async execution chains.
 */
export const requestContext = new AsyncLocalStorage();

/**
 * Helper to obtain the current correlation / request ID from AsyncLocalStorage.
 * @returns {string|null}
 */
export const getCorrelationId = () => {
  const store = requestContext.getStore();
  return store?.requestId || null;
};

/**
 * Comprehensive list of sensitive key patterns to redact.
 */
const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /jwt/i,
  /auth(orization)?/i,
  /cookie/i,
  /cookie_secure/i,
  /credential/i,
  /key/i,
  /cert/i,
  /private/i,
  /access[_-]?key/i,
  /secret[_-]?access[_-]?key/i,
  /mongo[_-]?uri/i,
  /database[_-]?url/i,
  /content/i, // Avoid logging document / collaborative text content
  /yjsupdate/i, // Avoid logging raw Yjs updates
];

/**
 * URI regex to catch embedded credentials in connection strings e.g. mongodb://user:pass@host/db
 */
const URI_CREDENTIAL_REGEX = /(mongodb(\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/gi;
const BEARER_REGEX = /(Bearer\s+)[A-Za-z0-9\-_.]+/gi;

/**
 * Redacts a string if it contains embedded credentials or JWT/Bearer tokens.
 * @param {string} val
 * @returns {string}
 */
export const redactString = (val) => {
  if (typeof val !== "string") return val;

  let redacted = val.replace(URI_CREDENTIAL_REGEX, "$1[REDACTED]:[REDACTED]@");
  redacted = redacted.replace(BEARER_REGEX, "$1[REDACTED]");

  return redacted;
};

/**
 * Deeply redacts sensitive fields from objects, arrays, and primitives.
 * Does not mutate the original data.
 *
 * @param {any} data - Object or value to redact
 * @param {number} [depth=0] - Recursion depth to prevent stack overflow
 * @param {Set} [seen=new Set()] - Circular reference tracking
 * @returns {any} Redacted safe copy
 */
export const redact = (data, depth = 0, seen = new Set()) => {
  if (depth > 8) return "[MAX_DEPTH_EXCEEDED]";
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return redactString(data);
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (typeof data === "bigint" || typeof data === "symbol") {
    return data.toString();
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: redactString(data.message),
      code: data.code,
      statusCode: data.statusCode,
      stack: env.isProduction ? undefined : redactString(data.stack),
    };
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Buffer.isBuffer(data)) {
    return `[Buffer: ${data.length} bytes]`;
  }

  if (Array.isArray(data)) {
    if (seen.has(data)) return "[CIRCULAR]";
    seen.add(data);
    const result = data.map((item) => redact(item, depth + 1, seen));
    seen.delete(data);
    return result;
  }

  if (typeof data === "object") {
    if (seen.has(data)) return "[CIRCULAR]";
    seen.add(data);
    const result = {};

    for (const [key, val] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

      if (isSensitiveKey) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redact(val, depth + 1, seen);
      }
    }

    seen.delete(data);
    return result;
  }

  return "[UNSUPPORTED_TYPE]";
};

/**
 * Standard log levels.
 */
export const LogLevel = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

const LOG_LEVEL_SEVERITY = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

/**
 * Structured Logger producing consistent JSON log events with safe redacted context.
 */
export class StructuredLogger {
  constructor(options = {}) {
    this.service = options.service || "klavo-backend";
    const isTestMode = env.isTest || Boolean(process.env.NODE_TEST_CONTEXT) || process.env.NODE_ENV === "test";
    this.minLevel = options.minLevel || (isTestMode ? "WARN" : env.isProduction ? "INFO" : "DEBUG");
    this.stream = options.stream || process.stdout;
    this.errorStream = options.errorStream || process.stderr;
  }

  /**
   * Determine if the given level should be emitted based on configured threshold.
   * @param {string} level
   * @returns {boolean}
   */
  shouldLog(level) {
    return (LOG_LEVEL_SEVERITY[level] || 0) >= (LOG_LEVEL_SEVERITY[this.minLevel] || 0);
  }

  /**
   * Core emission method. Builds structured JSON and outputs to stream.
   *
   * @param {string} level
   * @param {string} message
   * @param {object} [context={}]
   */
  log(level, message, context = {}) {
    if (!this.shouldLog(level)) return;

    const correlationId = context.requestId || getCorrelationId() || null;
    const safeContext = redact({ ...context });
    if (safeContext.requestId) delete safeContext.requestId;

    const logEntry = {
      timestamp: new Date().toISOString(),
      severity: level,
      service: this.service,
      environment: env.NODE_ENV,
      requestId: correlationId,
      message: redactString(message),
      ...(Object.keys(safeContext).length > 0 ? { context: safeContext } : {}),
    };

    const serialized = JSON.stringify(logEntry);

    if (level === LogLevel.ERROR) {
      this.errorStream.write(serialized + "\n");
    } else {
      this.stream.write(serialized + "\n");
    }

    return logEntry;
  }

  debug(message, context = {}) {
    return this.log(LogLevel.DEBUG, message, context);
  }

  info(message, context = {}) {
    return this.log(LogLevel.INFO, message, context);
  }

  warn(message, context = {}) {
    return this.log(LogLevel.WARN, message, context);
  }

  error(message, context = {}) {
    return this.log(LogLevel.ERROR, message, context);
  }
}

export const logger = new StructuredLogger();
