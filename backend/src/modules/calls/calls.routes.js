import crypto from 'node:crypto';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { listCalls, recordCall } from './calls.service.js';

function secretMatches(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(env.robocallWebhookSecret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Receiver for the provider. It has no login, so it is closed until a secret is
 * configured, and every request must carry that secret (?token=... on the URL
 * or an X-Webhook-Secret header).
 */
export const callsWebhookRouter = Router();

callsWebhookRouter.post('/', async (req, res, next) => {
  try {
    if (!env.robocallWebhookSecret) return res.status(503).json({ error: 'Robocall webhook is not configured.' });
    if (!secretMatches(req.query.token ?? req.get('x-webhook-secret'))) return res.status(401).json({ error: 'Invalid webhook secret.' });

    const result = await recordCall(req.body ?? {});
    return res.status(result.stored || result.duplicate ? 200 : 400).json(result);
  } catch (error) { next(error); }
});

export const callsRouter = Router();

callsRouter.use(requireAuth);
// Call history is for the admin and the operations desk.
callsRouter.get('/', requireRole('admin', 'operations'), async (req, res, next) => {
  try {
    const { status, q, page, limit } = req.query;
    return res.json(await listCalls({ status, q, page, limit }));
  } catch (error) { next(error); }
});
