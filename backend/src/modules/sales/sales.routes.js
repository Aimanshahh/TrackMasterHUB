import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getSalesBoard, cancelSale, restoreSale, getAgentCommissions, setCommissionPaid, getSalesPerformance } from './sales.service.js';

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

/* Sales performance: the admin's ranking and revenue view. */
salesRouter.get('/performance', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await getSalesPerformance({ from: req.query.from, to: req.query.to, salesperson: req.query.salesperson }) });
  } catch (error) { next(error); }
});

/* Agent-assisted sales and commission. This is money, so the admin owns it. */
salesRouter.get('/agents', requireRole('admin'), async (req, res, next) => {
  try {
    return res.json(await getAgentCommissions({ agent: req.query.agent }));
  } catch (error) { next(error); }
});

salesRouter.post('/agents/:id/commission', requireRole('admin'), async (req, res, next) => {
  try {
    return res.json({ data: await setCommissionPaid(req.params.id, req.body ?? {}, req.user) });
  } catch (error) { next(error); }
});

// A salesperson can cancel or restore their own sales; admin and manager can do it for any sale.
salesRouter.post('/:id/cancel', requireRole('salesperson', 'admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await cancelSale(req.params.id, req.user, req.body ?? {}) });
  } catch (error) { next(error); }
});

salesRouter.post('/:id/restore', requireRole('salesperson', 'admin', 'manager'), async (req, res, next) => {
  try {
    return res.json({ data: await restoreSale(req.params.id, req.user) });
  } catch (error) { next(error); }
});
