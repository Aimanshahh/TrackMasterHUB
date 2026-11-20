import Customer from '../../models/Customer.js';
import DirectMessage from '../../models/DirectMessage.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { env } from '../../config/env.js';
import { postToWhatsAppGateway, sendWhatsAppBulk } from '../../utils/whatsappGateway.js';

async function listDirectMessages(customerId) {
  const rows = await DirectMessage.find({ customer: customerId }).sort({ createdAt: -1 }).limit(50);
  return rows.map((row) => row.toApiJson());
}

async function createDirectMessage({ customerId, body, actorId }) {
  const customer = await Customer.findById(customerId).select('phone name');
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches this record.');
  const phone = String(customer.phone ?? '').trim();
  if (!phone) throw makeError(errorCodes.VALIDATION_ERROR, 'This customer has no phone number.');
  const text = String(body ?? '').trim();
  if (!text) throw makeError(errorCodes.VALIDATION_ERROR, 'Write a message before sending.');

  const message = await DirectMessage.create({
    customer: customerId,
    to: phone,
    body: text,
    createdBy: actorId,
    status: env.whatsappGatewayUrl ? 'pending' : 'not_configured',
    lastError: env.whatsappGatewayUrl ? '' : 'WhatsApp gateway is not configured on the server.',
  });

  if (env.whatsappGatewayUrl) {
    const result = await postToWhatsAppGateway(phone, customer.name, text);
    message.status = result.ok ? 'sent' : 'failed';
    message.lastError = result.error;
    message.sentAt = result.ok ? new Date() : null;
    await message.save();
  }
  return message.toApiJson();
}

async function createBroadcast({ body, actorId }) {
  const text = String(body ?? '').trim();
  if (!text) throw makeError(errorCodes.VALIDATION_ERROR, 'Write a message before sending.');

  const allCustomers = await Customer.find({}).select('_id phone name').lean();
  const customers = allCustomers.filter((customer) => String(customer.phone ?? '').trim());
  if (!customers.length) throw makeError(errorCodes.VALIDATION_ERROR, 'No customers have a phone number on file.');

  const live = Boolean(env.whatsappGatewayUrl);
  const createdAt = new Date();
  const rows = await DirectMessage.insertMany(customers.map((customer) => ({
    customer: customer._id,
    to: String(customer.phone).trim(),
    body: text,
    createdBy: actorId,
    status: live ? 'pending' : 'not_configured',
    lastError: live ? '' : 'WhatsApp gateway is not configured on the server.',
    createdAt,
    updatedAt: createdAt,
  })));

  if (!live) {
    return {
      queued: rows.length,
      skipped: allCustomers.length - customers.length,
      status: 'not_configured',
      message: 'Messages were saved, but the WhatsApp gateway is not configured on the server, so nothing was sent.',
    };
  }

  // A long list takes minutes, so answer now and send in the background; every row records its own result.
  const nameById = new Map(customers.map((customer) => [String(customer._id), customer.name]));
  const items = rows.map((row) => ({ id: row._id, phoneNumber: row.to, customerName: nameById.get(String(row.customer)) ?? '', message: row.body }));
  setImmediate(() => {
    sendWhatsAppBulk(items, {
      onResult: (item, result) => DirectMessage.updateOne(
        { _id: item.id },
        { $set: { status: result.ok ? 'sent' : 'failed', lastError: result.error, sentAt: result.ok ? new Date() : null } },
      ),
    }).catch((error) => console.error('[whatsapp-gateway] Bulk send stopped:', error.message));
  });

  return {
    queued: rows.length,
    skipped: allCustomers.length - customers.length,
    status: 'sending',
    message: `Sending ${rows.length} messages through the WhatsApp gateway. Each one shows Sent or Failed in its customer's history.`,
  };
}

export { listDirectMessages, createDirectMessage, createBroadcast };
