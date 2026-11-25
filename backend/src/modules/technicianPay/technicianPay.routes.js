import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import {
  getAccount,
  listAccounts,
  recordPayment,
  reverseEarning,
} from './technicianPay.service.js';

export const technicianPayRouter = Router();

technicianPayRouter.use(requireAuth);

async function accounts(req, res, next) {
  try { return res.json(await listAccounts()); } catch (error) { next(error); }
}

async function account(req, res, next) {
  try { return res.json({ data: await getAccount(req.params.id) }); } catch (error) { next(error); }
}

async function postPayment(req, res, next) {
  try { return res.status(201).json({ data: await recordPayment(req.params.id, req.body ?? {}, req.user) }); } catch (error) { next(error); }
}

async function postReverse(req, res, next) {
  try { return res.json({ data: await reverseEarning(req.params.id, req.body ?? {}, req.user) }); } catch (error) { next(error); }
}

/* Money is the admin's decision, never operations' or a technician's. */
technicianPayRouter.get('/', requireAdmin, accounts);
technicianPayRouter.get('/:id', requireAdmin, account);
technicianPayRouter.post('/:id/payments', requireAdmin, postPayment);
technicianPayRouter.post('/earnings/:id/reverse', requireAdmin, postReverse);
