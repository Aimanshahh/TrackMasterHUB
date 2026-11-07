import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'));

const supportedEnvironments = ['development', 'test', 'staging', 'production'];

function readPort(rawPort) {
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT value: ' + rawPort + '. Expected an integer between 1 and 65535.');
  }

  return port;
}

function readOrigins(rawOrigins) {
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!supportedEnvironments.includes(nodeEnv)) {
  throw new Error('Invalid NODE_ENV ' + nodeEnv + '. Expected one of: ' + supportedEnvironments.join(', ') + '.');
}

const jwts = process.env.JWT_SECRET ? [process.env.JWT_SECRET] : ['trackmaster-hub-dev-secret'];

if (jwts.some((secret) => secret.length < 32)) {
  console.warn('[trackmaster-hub-api] JWT_SECRET is shorter than 32 characters. Set a longer value in .env for production.');
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: readPort(process.env.API_PORT ?? process.env.PORT ?? 4000),
  clientOrigins: readOrigins(process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'),
  serviceName: 'trackmaster-hub-api',
  version: pkg.version,
  mongoUri: process.env.MONGO_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'trackmaster-hub-dev-secret',
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
  bootstrapTokenTtlSeconds: Number(process.env.BOOTSTRAP_TOKEN_TTL_SECONDS ?? 3600),
  workspaceName: process.env.WORKSPACE_NAME ?? 'TrackMaster Hub',
  supportEmail: process.env.SUPPORT_EMAIL ?? 'support@trackmaster.example',
  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 60),
  // Live vehicle status from the GPSWOX tracking server. Store the API hash
  // only on the backend; it must never be sent to the browser.
  trackingApiUrl: (process.env.TRACKING_API_URL ?? '').trim().replace(/\/api\/get_devices\/?$/, '').replace(/\/+$/, ''),
  trackingApiHash: (process.env.TRACKING_API_HASH ?? '').trim(),
  trackingSyncSeconds: Math.max(30, Number(process.env.TRACKING_SYNC_SECONDS ?? 300) || 300),
  trackingInactiveHours: Math.max(1, Number(process.env.TRACKING_INACTIVE_HOURS ?? 24) || 24),
  // GPSWOX sends times without a zone. This is the zone it uses (Pakistan).
  trackingTimeOffset: (process.env.TRACKING_TIME_OFFSET ?? '+05:00').trim(),
  // Outgoing email (complaint updates to customers). Without SMTP_HOST the
  // system records each message as "not configured" and sends nothing.
  smtpHost: (process.env.SMTP_HOST ?? '').trim(),
  smtpPort: Number(process.env.SMTP_PORT ?? 587) || 587,
  smtpSecure: String(process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  smtpUser: (process.env.SMTP_USER ?? '').trim(),
  smtpPass: process.env.SMTP_PASS ?? '',
  mailFrom: (process.env.MAIL_FROM ?? '').trim(),
  mailBusinessName: (process.env.MAIL_BUSINESS_NAME ?? 'TrackMaster').trim(),
  mailRetrySeconds: Math.max(5, Number(process.env.MAIL_RETRY_SWEEP_SECONDS ?? 60) || 60),
  // Shared secret the robocall provider must send. Empty = webhook closed.
  robocallWebhookSecret: (process.env.ROBOCALL_WEBHOOK_SECRET ?? '').trim(),
  trackingTimeoutMs: Math.max(1000, Number(process.env.TRACKING_TIMEOUT_MS ?? 15000) || 15000),
};
