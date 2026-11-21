import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getSalesBoard } from './sales.service.js';

export const salesRouter = Router();

salesRouter.use(requireAuth);

// The salesperson's id comes from the session, never from the browser.
salesRouter.get('/mine', requireRole('salesperson'), async (req, res, next) => {
  try {
    return res.json({ data: await getSalesBoard({ ownerId: req.user.id }) });
  } catch (error) { next(error); }
});

salesRouter.get('/overview', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await getSalesBoard() });
  } catch (error) { next(error); }
});
