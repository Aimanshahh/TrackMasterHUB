import Customer from '../../models/Customer.js';
import DirectMessage from '../../models/DirectMessage.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

async function listDirectMessages(customerId) {
  const rows = await DirectMessage.find({ customer: customerId }).sort({ createdAt: -1 }).limit(50);
  return rows.map((row) => row.toApiJson());
}

async function createDirectMessage({ customerId, body, actorId }) {
  const customer = await Customer.findById(customerId).select('phone');
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
    status: 'not_configured',
    lastError: 'WhatsApp Meta API is not configured yet.',
  });
  return message.toApiJson();
}

async function createBroadcast({ body, actorId }) {
  const text = String(body ?? '').trim();
  if (!text) throw makeError(errorCodes.VALIDATION_ERROR, 'Write a message before sending.');

  const allCustomers = await Customer.find({}).select('_id phone').lean();
  const customers = allCustomers.filter((customer) => String(customer.phone ?? '').trim());
  if (!customers.length) throw makeError(errorCodes.VALIDATION_ERROR, 'No customers have a phone number on file.');

  const createdAt = new Date();
  const rows = await DirectMessage.insertMany(customers.map((customer) => ({
    customer: customer._id,
    to: String(customer.phone).trim(),
    body: text,
    createdBy: actorId,
    status: 'not_configured',
    lastError: 'WhatsApp Meta API is not configured yet.',
    createdAt,
    updatedAt: createdAt,
  })));

  return {
    queued: rows.length,
    skipped: allCustomers.length - customers.length,
    status: 'not_configured',
    message: 'Messages were saved and will require Meta WhatsApp configuration before delivery.',
  };
}

export { listDirectMessages, createDirectMessage, createBroadcast };
