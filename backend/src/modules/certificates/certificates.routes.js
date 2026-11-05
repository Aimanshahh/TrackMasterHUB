import { Router } from 'express';

import { requireAuth, requireRole } from '../../middleware/auth.js';
import { renderCertificatePdf } from './certificate.pdf.js';
import {
  cancelCertificate,
  getCertificate,
  issueCertificates,
  listCertificates,
  reissueCertificate,
  searchCertificateCustomers,
} from './certificates.service.js';

export const certificatesRouter = Router();

certificatesRouter.use(requireAuth);
// Certificates belong to the manager desk; the admin can open it too.
certificatesRouter.use(requireRole('admin', 'manager'));

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };

certificatesRouter.get('/', wrap(async (req, res) => {
  const { q, status, customer, job, page, limit } = req.query;
  res.json(await listCertificates({ q, status, customer, job, page, limit }));
}));

certificatesRouter.get('/customers', wrap(async (req, res) => {
  res.json({ data: await searchCertificateCustomers({ q: req.query.q, limit: req.query.limit }) });
}));

certificatesRouter.post('/', wrap(async (req, res) => {
  res.status(201).json({ data: { certificates: await issueCertificates(req.body ?? {}, req.user) } });
}));

certificatesRouter.get('/:id', wrap(async (req, res) => {
  res.json({ data: { certificate: await getCertificate(req.params.id) } });
}));

certificatesRouter.get('/:id/pdf', wrap(async (req, res) => {
  const cert = await getCertificate(req.params.id);
  const pdf = await renderCertificatePdf(cert);
  const safeName = `Tracker-Certificate-${cert.number}`.replace(/[^A-Za-z0-9._-]/g, '_');
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdf.length,
    'Content-Disposition': `${req.query.download ? 'attachment' : 'inline'}; filename="${safeName}.pdf"`,
  });
  res.send(pdf);
}));

certificatesRouter.post('/:id/reissue', wrap(async (req, res) => {
  res.status(201).json({ data: { certificate: await reissueCertificate(req.params.id, req.body ?? {}, req.user) } });
}));

certificatesRouter.post('/:id/cancel', wrap(async (req, res) => {
  res.json({ data: { certificate: await cancelCertificate(req.params.id, req.body ?? {}, req.user) } });
}));
