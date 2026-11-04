import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  getAdjustment,
  getInvoice,
  getInvoicePayments,
  getInvoices,
  getPayments,
  getSeries,
  getSummary,
  postCancelInvoice,
  postCreditNote,
  postInvoice,
  postIssueInvoice,
  postPayment,
  postRefund,
} from './billing.controller.js';

export const billingRouter = Router();

billingRouter.use(requireAuth);

// Money records are visible to the billing authority (manager) and the admin.
// Operations and salespeople see only their own commercial figures elsewhere.
const billingDesk = requireRole('admin', 'manager');

billingRouter.get('/summary', billingDesk, getSummary);
billingRouter.get('/series', billingDesk, getSeries);

billingRouter.get('/invoices', billingDesk, getInvoices);
billingRouter.post('/invoices', billingDesk, postInvoice);
billingRouter.get('/invoices/:id', billingDesk, getInvoice);
billingRouter.post('/invoices/:id/issue', billingDesk, postIssueInvoice);
billingRouter.post('/invoices/:id/cancel', billingDesk, postCancelInvoice);
billingRouter.get('/invoices/:id/payments', billingDesk, getInvoicePayments);

// A payment is always recorded against an invoice, which is what keeps partial
// instalments attached to the right sale.
billingRouter.get('/payments', billingDesk, getPayments);
billingRouter.post('/invoices/:id/payments', billingDesk, postPayment);

// Corrections to an issued invoice. Both are append-only records that need a
// written reason; nothing is edited or deleted.
billingRouter.post('/invoices/:id/credit-notes', billingDesk, postCreditNote);
billingRouter.post('/invoices/:id/refunds', billingDesk, postRefund);
billingRouter.get('/adjustments/:id', billingDesk, getAdjustment);
