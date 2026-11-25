import { clearHotLead, listHotLeads, setHotLead } from './hotLeads.service.js';

async function getHotLeads(req, res, next) {
  try {
    return res.json(await listHotLeads({ actor: req.user, status: req.query.status }));
  } catch (error) { next(error); }
}

async function postHotLead(req, res, next) {
  try {
    return res.json({ data: { lead: await setHotLead(req.params.id, req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

async function deleteHotLead(req, res, next) {
  try {
    return res.json({ data: await clearHotLead(req.params.id, req.user, req.body ?? {}) });
  } catch (error) { next(error); }
}

export { getHotLeads, postHotLead, deleteHotLead };
