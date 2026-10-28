import { Router } from 'express';
import { env } from '../config/env.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { customersRouter } from '../modules/customers/customers.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { activityRouter } from '../modules/activity/activity.routes.js';

/** Every feature module mounts here. Future modules (sales, operations, etc.) follow the same pattern. */
export const apiRouter = Router();

apiRouter.get('/', (req, res) => {
  res.json({
    name: 'TrackMaster Hub API',
    version: env.version,
    environment: env.nodeEnv,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      customers: '/api/customers',
      dashboard: '/api/dashboard',
      activity: '/api/activity',
    },
  });
});

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/customers', customersRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/activity', activityRouter);
