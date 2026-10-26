import { Router } from 'express';
import { env } from '../config/env.js';
import { healthRouter } from '../modules/health/health.routes.js';

/**
 * Every feature module mounts here. Future modules (customers, sales,
 * operations, tickets, billing) follow the same module pattern:
 * routes -> controller -> service.
 */
export const apiRouter = Router();

apiRouter.get('/', (req, res) => {
  res.json({
    name: 'TrackMaster Hub API',
    version: env.version,
    environment: env.nodeEnv,
    endpoints: {
      health: '/api/health',
    },
  });
});

apiRouter.use('/health', healthRouter);
