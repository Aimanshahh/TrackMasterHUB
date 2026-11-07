import { createBroadcast, createDirectMessage, listDirectMessages } from './messages.service.js';

async function getCustomerMessages(req, res, next) {
  try {
    return res.json({ data: { messages: await listDirectMessages(req.params.customerId) } });
  } catch (error) { next(error); }
}

async function postDirectMessage(req, res, next) {
  try {
    const message = await createDirectMessage({
      customerId: req.params.customerId,
      body: req.body?.body,
      actorId: req.user.id,
    });
    return res.status(201).json({ data: { message } });
  } catch (error) { next(error); }
}

async function postBroadcast(req, res, next) {
  try {
    return res.status(201).json({ data: await createBroadcast({ body: req.body?.body, actorId: req.user.id }) });
  } catch (error) { next(error); }
}

export { getCustomerMessages, postDirectMessage, postBroadcast };
