import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getSalesBoard, resumeSale, suspendSale } from './sales.service.js';

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

// A salesperson can hold or resume their own sales; admin and manager can do it for any sale.
salesRouter.post('/:id/suspend', requireRole('salesperson', 'admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await suspendSale(req.params.id, req.user, req.body ?? {}) });
  } catch (error) { next(error); }
});

salesRouter.post('/:id/resume', requireRole('salesperson', 'admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await resumeSale(req.params.id, req.user) });
  } catch (error) { next(error); }
});
