import { getCustomerProfile, searchCustomers } from './customers.service.js';
import { createTemplate, listTemplates, previewMessage, sendTemplateMessage } from './whatsapp.service.js';

export async function getDeskCustomers(req, res, next) {
  try {
    return res.json(await searchCustomers({ search: req.query.search, limit: req.query.limit }));
  } catch (error) { next(error); }
}

export async function getDeskCustomer(req, res, next) {
  try {
    return res.json({ data: await getCustomerProfile(req.params.id) });
  } catch (error) { next(error); }
}

export async function getMessageTemplates(req, res, next) {
  try {
    return res.json(await listTemplates());
  } catch (error) { next(error); }
}

export async function postMessageTemplate(req, res, next) {
  try {
    return res.status(201).json({ data: { template: await createTemplate(req.body ?? {}, req.user) } });
  } catch (error) { next(error); }
}

export async function postMessagePreview(req, res, next) {
  try {
    return res.json({ data: await previewMessage(req.body ?? {}) });
  } catch (error) { next(error); }
}

export async function postWhatsAppSend(req, res, next) {
  try {
    return res.json({ data: await sendTemplateMessage(req.body ?? {}, req.user) });
  } catch (error) { next(error); }
}
