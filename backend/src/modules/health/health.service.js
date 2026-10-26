import { env } from '../../config/env.js';

const startedAt = new Date();

/**
 * Single source of truth for the health payload, so other modules can reuse it
 * (for example a readiness probe once the database is connected).
 */
export function getHealthSnapshot() {
  return {
    status: 'ok',
    service: {
      name: env.serviceName,
      version: env.version,
      environment: env.nodeEnv,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: startedAt.toISOString(),
    timestamp: new Date().toISOString(),
    checks: {
      api: 'operational',
    },
  };
}
