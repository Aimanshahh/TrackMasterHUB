import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getCustomerHistoryReport, getCustomers, getCustomer, createCustomerRecord, patchCustomerRecord, deleteCustomerRecord } from './customers.controller.js';
import { deleteHotLead, getHotLeads, postHotLead } from './hotLeads.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getCustomers);

/* Hot leads: a flag on the same customer record, not a second customer. */
router.get('/hot-leads', requireRole('admin', 'manager', 'salesperson'), getHotLeads);
router.post('/:id/hot-lead', requireRole('admin', 'manager', 'salesperson'), postHotLead);
router.delete('/:id/hot-lead', requireRole('admin', 'manager', 'salesperson'), deleteHotLead);

router.get('/:id/history', getCustomerHistoryReport);
router.get('/:id', getCustomer);
router.post('/', createCustomerRecord);
router.patch('/:id', patchCustomerRecord);
router.delete('/:id', requireRole('admin'), deleteCustomerRecord);

export const customersRouter = router;
