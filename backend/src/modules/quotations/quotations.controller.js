import {
  createQuotation,
  decideQuotation,
  getQuotationDetail,
  listQuotations,
  reviseQuotation,
  sendQuotation,
  updateQuotation,
} from './quotations.service.js';

async function getQuotations(req, res, next) {
  try {
    const { q, status, customer, page, limit } = req.query;
    return res.json(await listQuotations({ q, status, customer, page, limit }, req.user));
  } catch (error) { next(error); }
}

async function getQuotation(req, res, next) {
  try {
    return res.json({ data: await getQuotationDetail(req.params.id, req.user) });
  } catch (error) { next(error); }
}

async function postQuotation(req, res, next) {
  try {
    return res.status(201).json({ data: { quotation: await createQuotation(req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function patchQuotation(req, res, next) {
  try {
    return res.json({ data: { quotation: await updateQuotation(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function postSend(req, res, next) {
  try {
    return res.json({ data: { quotation: await sendQuotation(req.params.id, req.user) } });
  } catch (error) { next(error); }
}

async function postDecision(req, res, next) {
  try {
    return res.json({ data: { quotation: await decideQuotation(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function postRevise(req, res, next) {
  try {
    return res.json({ data: { quotation: await reviseQuotation(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

export {
  getQuotation,
  getQuotations,
  patchQuotation,
  postDecision,
  postQuotation,
  postRevise,
  postSend,
};
