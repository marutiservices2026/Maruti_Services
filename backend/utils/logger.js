// logger.js — structured JSON logger (Section 10). Every log line carries a timestamp,
// level, and context, so it's searchable later instead of scattered console.log calls.
// Console (stdout) is the only transport wired in v1 — Render captures it automatically.
// Add a persistent transport (Better Stack, Logtail, Sentry for error tracking) here once
// traffic grows, since Render's own log retention is short-lived.
import winston from 'winston';
import { env } from '../config/env.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'authorization',
  'gstin',
  'pan',
  'accountno',
  'bankdetails',
]);

// Recursively strips sensitive fields from anything passed to the logger, so a stray
// `logger.info({ ...req.body })` can never leak a password, token, GSTIN, PAN, or bank
// detail into the log stream (Section 9/10: "Never log" list).
function redact(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value; // Date has no enumerable own props — don't flatten it
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, seen);
  }
  return out;
}

// Must mutate and return the SAME `info` instance rather than build a new plain object —
// winston/triple-beam attach internal Symbol-keyed properties (Symbol.for('level'),
// Symbol.for('message')) to `info` that downstream formats/transports depend on.
// Replacing `info` with a fresh object silently drops those, and the Console transport
// then no-ops instead of throwing — a very easy failure to miss.
const redactFormat = winston.format((info) => {
  Object.assign(info, redact(info));
  return info;
});

const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
