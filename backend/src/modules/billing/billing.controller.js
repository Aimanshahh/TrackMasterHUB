import {
  cancelInvoice,
  createInvoice,
  getBillingSummary,
  getMonthlySeries,
  issueInvoice,
  listInvoicePayments,
  listInvoices,
  listPayments,
  recordPayment,
} from './billing.service.js';

async function getInvoices(req, res, next) {
  try {
    const { q, status, paymentState, customer, job, page, limit } = req.query;
    return res.json(await listInvoices({ q, status, paymentState, customer, job, page, limit }));
  } catch (error) { next(error); }
}

async function postInvoice(req, res, next) {
  try {
    const invoice = await createInvoice(req.body ?? {}, req.user);
    return res.status(201).json({ data: { invoice } });
  } catch (error) { next(error); }
}

async function postIssueInvoice(req, res, next) {
  try {
    const invoice = await issueInvoice(req.params.id, req.user);
    return res.json({ data: { invoice } });
  } catch (error) { next(error); }
}

async function postCancelInvoice(req, res, next) {
  try {
    const invoice = await cancelInvoice(req.params.id, req.body ?? {}, req.user);
    return res.json({ data: { invoice } });
  } catch (error) { next(error); }
}

async function getPayments(req, res, next) {
  try {
    const { q, method, from, to, invoice, customer, page, limit } = req.query;
    return res.json(await listPayments({ q, method, from, to, invoice, customer, page, limit }));
  } catch (error) { next(error); }
}

async function postPayment(req, res, next) {
  try {
    const result = await recordPayment(req.params.id, req.body ?? {}, req.user);
    return res.status(201).json({ data: result });
  } catch (error) { next(error); }
}

async function getInvoicePayments(req, res, next) {
  try {
    return res.json({ data: await listInvoicePayments(req.params.id) });
  } catch (error) { next(error); }
}

async function getSummary(req, res, next) {
  try {
    return res.json({ data: await getBillingSummary() });
  } catch (error) { next(error); }
}

async function getSeries(req, res, next) {
  try {
    return res.json({ data: await getMonthlySeries(Number(req.query.months) || 6) });
  } catch (error) { next(error); }
}

export {
  getInvoices,
  postInvoice,
  postIssueInvoice,
  postCancelInvoice,
  getPayments,
  postPayment,
  getInvoicePayments,
  getSummary,
  getSeries,
};
