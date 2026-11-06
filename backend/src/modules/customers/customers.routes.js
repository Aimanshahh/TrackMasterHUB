import express from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getCustomerHistoryReport, getCustomers, getCustomer, createCustomerRecord, patchCustomerRecord, deleteCustomerRecord } from './customers.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getCustomers);
router.get('/:id/history', getCustomerHistoryReport);
router.get('/:id', getCustomer);
router.post('/', createCustomerRecord);
router.patch('/:id', patchCustomerRecord);
router.delete('/:id', requireRole('admin'), deleteCustomerRecord);

export const customersRouter = router;
