import Customer from '../../models/Customer.js';
import DirectMessage from '../../models/DirectMessage.js';
import MessageTemplate from '../../models/MessageTemplate.js';
import TimelineEvent from '../../models/TimelineEvent.js';
import User from '../../models/User.js';
import { env } from '../../config/env.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { postToWhatsAppGateway } from '../../utils/whatsappGateway.js';
import { DEFAULT_TEMPLATES, MISSING_HINTS, TEMPLATE_VARIABLES, placeholdersIn, renderTemplate, slugify } from '../../utils/messageTemplates.js';

/** The two templates the system ships with. Safe to call any time: it only adds what is missing. */
export async function ensureDefaultTemplates() {
  for (const template of DEFAULT_TEMPLATES) {
    await MessageTemplate.updateOne({ key: template.key }, { $setOnInsert: { ...template, builtIn: true, active: true } }, { upsert: true });
  }
}

export async function listTemplates() {
  await ensureDefaultTemplates();
  const rows = await MessageTemplate.find({ active: true }).sort({ builtIn: -1, name: 1 });
  return {
    data: rows.map((row) => row.toApiJson()),
    meta: { variables: TEMPLATE_VARIABLES.map((variable) => `[${variable.name}]`) },
  };
}

export async function createTemplate(input, actor) {
  const name = String(input?.name ?? '').trim();
  const body = String(input?.body ?? '').trim();
  if (name.length < 2 || name.length > 80) throw makeError(errorCodes.VALIDATION_ERROR, 'Give the template a name of 2 to 80 characters.');
  if (body.length < 5 || body.length > 1000) throw makeError(errorCodes.VALIDATION_ERROR, 'Write a message of 5 to 1000 characters.');

  const unknown = placeholdersIn(body).filter((entry) => !entry.variable).map((entry) => entry.raw);
  if (unknown.length) {
    throw makeError(errorCodes.VALIDATION_ERROR, `${[...new Set(unknown)].join(', ')} cannot be filled in. You can use: ${TEMPLATE_VARIABLES.map((variable) => `[${variable.name}]`).join(', ')}.`);
  }

  const key = slugify(name);
  if (!key) throw makeError(errorCodes.VALIDATION_ERROR, 'The template name needs letters or numbers.');
  await ensureDefaultTemplates();
  if (await MessageTemplate.exists({ key })) throw makeError(errorCodes.CONFLICT, `A template called "${name}" already exists.`, 409);

  const row = await MessageTemplate.create({ key, name, body, builtIn: false, createdBy: actor.id });
  return row.toApiJson();
}

async function loadPair(templateId, customerId) {
  await ensureDefaultTemplates();
  const [template, customer] = await Promise.all([
    MessageTemplate.findOne({ _id: templateId, active: true }).catch(() => null),
    Customer.findById(customerId).catch(() => null),
  ]);
  if (!template) throw makeError(errorCodes.NOT_FOUND, 'No template matches that id.', 404);
  if (!customer) throw makeError(errorCodes.NOT_FOUND, 'No customer matches that id.', 404);
  return { template, customer };
}

/** What the message will say for this customer, and anything that is still missing. */
export async function previewMessage({ templateId, customerId }) {
  const { template, customer } = await loadPair(templateId, customerId);
  const { text, missing } = renderTemplate(template.body, customer);
  return {
    text,
    template: { id: template._id.toString(), name: template.name },
    customer: { id: customer._id.toString(), name: customer.name, phone: customer.phone ?? '' },
    missing: missing.map((name) => ({ name, hint: MISSING_HINTS[name] ?? 'a value is missing' })),
    canSend: missing.length === 0 && Boolean(String(customer.phone ?? '').trim()),
  };
}

/**
 * Send one template message through the WhatsApp gateway. The text is always
 * built here from the template and the customer's own record, never taken from
 * the browser. A successful send adds "WhatsApp Sent: <template>" to the
 * customer's history. The saved copy of the message hides any password.
 */
export async function sendTemplateMessage({ templateId, customerId }, actor) {
  const { template, customer } = await loadPair(templateId, customerId);
  const phone = String(customer.phone ?? '').trim();
  if (!phone) throw makeError(errorCodes.VALIDATION_ERROR, 'This customer has no phone number.');

  const { text, logText, missing } = renderTemplate(template.body, customer);
  if (missing.length) {
    throw makeError(errorCodes.VALIDATION_ERROR, `This message cannot be sent yet: ${missing.map((name) => MISSING_HINTS[name] ?? name).join('; ')}.`);
  }

  const configured = Boolean(env.whatsappGatewayUrl);
  const record = await DirectMessage.create({
    customer: customer._id,
    to: phone,
    body: logText,
    createdBy: actor.id,
    status: configured ? 'pending' : 'not_configured',
    lastError: configured ? '' : 'WhatsApp gateway is not configured on the server.',
  });

  if (!configured) return { sent: false, error: record.lastError, message: record.toApiJson(), event: null };

  const result = await postToWhatsAppGateway(phone, customer.name, text);
  record.status = result.ok ? 'sent' : 'failed';
  record.lastError = result.error;
  record.sentAt = result.ok ? new Date() : null;
  await record.save();
  if (!result.ok) return { sent: false, error: result.error, message: record.toApiJson(), event: null };

  const user = await User.findById(actor.id).select('name');
  const event = await TimelineEvent.create({
    customer: customer._id,
    kind: 'whatsapp',
    action: template.name,
    detail: '',
    actorName: user?.name ?? '',
    date: record.sentAt,
    isHistoricalData: false,
  });
  return { sent: true, error: '', message: record.toApiJson(), event: event.toApiJson() };
}
