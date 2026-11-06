import express, { Router } from 'express';

import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  batchReportCsv,
  confirmBatch,
  createBatchFromUpload,
  deleteBatch,
  getBatch,
  getBatchRows,
  importFields,
  listBatches,
  previewBatch,
} from './imports.service.js';
import { MAX_BYTES } from './parse.js';

export const importsRouter = Router();

importsRouter.use(requireAuth);
// Bulk import changes many records at once, so it is admin-only.
importsRouter.use(requireRole('admin'));

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (error) { next(error); } };

importsRouter.get('/fields', (req, res) => res.json({ data: { fields: importFields() } }));

importsRouter.get('/', wrap(async (req, res) => {
  res.json(await listBatches({ page: req.query.page, limit: req.query.limit }));
}));

// The file is sent as raw bytes (not JSON) with its name in a header.
importsRouter.post('/upload', express.raw({ type: () => true, limit: MAX_BYTES }), wrap(async (req, res) => {
  const name = decodeURIComponent(String(req.get('x-file-name') ?? 'upload'));
  res.status(201).json({ data: await createBatchFromUpload(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), name, req.user) });
}));

importsRouter.get('/:id', wrap(async (req, res) => {
  res.json({ data: { batch: await getBatch(req.params.id) } });
}));

importsRouter.get('/:id/rows', wrap(async (req, res) => {
  res.json(await getBatchRows(req.params.id, { status: req.query.status, page: req.query.page, limit: req.query.limit }));
}));

importsRouter.delete('/:id', wrap(async (req, res) => {
  res.json({ data: await deleteBatch(req.params.id) });
}));

importsRouter.get('/:id/report.csv', wrap(async (req, res) => {
  const { name, csv } = await batchReportCsv(req.params.id);
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name.replace(/[^A-Za-z0-9._-]/g, '_')}"` });
  res.send(`﻿${csv}`);
}));

importsRouter.post('/:id/preview', wrap(async (req, res) => {
  res.json({ data: await previewBatch(req.params.id, req.body ?? {}) });
}));

importsRouter.post('/:id/confirm', wrap(async (req, res) => {
  res.json({ data: await confirmBatch(req.params.id, req.body ?? {}, req.user) });
}));
