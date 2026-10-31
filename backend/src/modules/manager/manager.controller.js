import {
  getCustomerProfile,
  getManagerSummary,
  listBillingQueue,
  listCustomers,
  saveBriefing,
} from './manager.service.js';

async function getSummary(req, res, next) {
  try {
    return res.json({ data: await getManagerSummary() });
  } catch (error) { next(error); }
}

async function getCustomerLookup(req, res, next) {
  try {
    const { q, accountStatus, page, limit } = req.query;
    return res.json(await listCustomers({ q, accountStatus, page, limit }));
  } catch (error) { next(error); }
}

async function getCustomer(req, res, next) {
  try {
    return res.json(await getCustomerProfile(req.params.id));
  } catch (error) { next(error); }
}

async function patchBriefing(req, res, next) {
  try {
    return res.json(await saveBriefing(req.params.id, req.body ?? {}, req.user));
  } catch (error) { next(error); }
}

async function getQueue(req, res, next) {
  try {
    return res.json(await listBillingQueue({ page: req.query.page, limit: req.query.limit }));
  } catch (error) { next(error); }
}

export { getSummary, getCustomerLookup, getCustomer, patchBriefing, getQueue };
