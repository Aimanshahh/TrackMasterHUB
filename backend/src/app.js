import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { parseCookies } from './middleware/cookie.js';
import { resolveUser } from './middleware/auth.js';
import { notFound } from './middleware/notFound.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigins,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(parseCookies);
  app.use(resolveUser);
  app.use(requestId);
  app.use(requestLogger);

  app.get('/', (req, res) => {
    res.json({
      name: 'TrackMaster Hub API',
      version: env.version,
      health: '/api/health',
    });
  });

  // Every API answer depends on the signed-in user, so no response may be
  // stored by a browser or an intermediary. Without this a cached /auth/me
  // can keep answering with the account the operator just signed out of.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
