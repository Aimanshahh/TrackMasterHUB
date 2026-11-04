import nodemailer from 'nodemailer';

import { env } from '../../config/env.js';
import Customer from '../../models/Customer.js';
import MessageDelivery from '../../models/MessageDelivery.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';
import { renderComplaintEmail } from './templates.js';

export const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000];

let transport = null;
let transportOverride = null;

/** Tests inject a fake transport; pass null to go back to SMTP. */
export function setTransportForTests(fake) {
  transportOverride = fake;
}

export function emailConfigured() {
  return Boolean(transportOverride || (env.smtpHost && env.mailFrom));
}

function getTransport() {
  if (transportOverride) return transportOverride;
  if (!emailConfigured()) return null;
  transport ??= nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  return transport;
}

const safeError = (error) => String(error?.message ?? 'Send failed').slice(0, 300);
const validEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? '').trim());

/**
 * Record the messages for one complaint event. This never throws: a mail
 * problem must not block logging or changing a complaint. WhatsApp has no
 * provider yet, so it is recorded as "not configured".
 */
export async function queueComplaintMessages(complaint, template, historyIndex) {
  try {
    const customer = complaint.customer ? await Customer.findById(complaint.customer) : null;
    const to = customer?.email?.trim() ?? '';
    const base = {
      complaint: complaint._id,
      complaintReference: complaint.reference,
      customer: complaint.customer ?? undefined,
      template,
      historyIndex,
    };

    const { subject, body } = renderComplaintEmail(
      template,
      { customerName: complaint.customerName, reference: complaint.reference, title: complaint.title, resolution: complaint.resolution },
      env.mailBusinessName,
    );

    let status = 'pending';
    let lastError = '';
    if (!validEmail(to)) { status = 'skipped'; lastError = 'The customer has no valid email address on file.'; }
    else if (!emailConfigured()) { status = 'not_configured'; lastError = 'Email sending is not set up on the server.'; }

    const email = await MessageDelivery.create({
      ...base, channel: 'email', to, subject, body, status, lastError, nextAttemptAt: status === 'pending' ? new Date() : null,
    });

    await MessageDelivery.create({
      ...base, channel: 'whatsapp', to: complaint.phone ?? '', subject, body, status: 'not_configured', lastError: 'WhatsApp is not connected yet.',
    });

    if (status === 'pending') {
      setImmediate(() => deliverMessage(email._id).catch(() => {}));
    }
  } catch (error) {
    if (error?.code === 11000) return; // already recorded for this event
    console.error('[trackmaster-hub-api] could not queue complaint messages:', safeError(error));
  }
}

/** One send attempt. Failures schedule a retry until MAX_ATTEMPTS, then stay failed for a person to handle. */
export async function deliverMessage(id) {
  const message = await MessageDelivery.findById(id);
  if (!message || !['pending', 'retrying'].includes(message.status)) return message;

  const mail = getTransport();
  if (!mail) {
    message.status = 'not_configured';
    message.lastError = 'Email sending is not set up on the server.';
    message.nextAttemptAt = null;
    await message.save();
    return message;
  }

  message.attempts += 1;
  try {
    await mail.sendMail({ from: env.mailFrom, to: message.to, subject: message.subject, text: message.body });
    message.status = 'sent';
    message.sentAt = new Date();
    message.lastError = '';
    message.nextAttemptAt = null;
  } catch (error) {
    message.lastError = safeError(error);
    if (message.attempts >= MAX_ATTEMPTS) {
      message.status = 'failed';
      message.nextAttemptAt = null;
    } else {
      message.status = 'retrying';
      message.nextAttemptAt = new Date(Date.now() + BACKOFF_MS[Math.min(message.attempts - 1, BACKOFF_MS.length - 1)]);
    }
  }
  await message.save();
  return message;
}

/** Pick up everything due for another try. Returns how many were attempted. */
export async function sweepMessages(now = new Date()) {
  const due = await MessageDelivery.find({ status: { $in: ['pending', 'retrying'] }, channel: 'email', nextAttemptAt: { $lte: now } }).limit(25);
  for (const message of due) await deliverMessage(message._id);
  return due.length;
}

let sweepTimer = null;
export function startMessageSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => sweepMessages().catch(() => {}), env.mailRetrySeconds * 1000);
  sweepTimer.unref?.();
}

/** Put a failed or unconfigured email back in the queue. */
export async function retryMessage(id) {
  const message = await MessageDelivery.findById(id);
  if (!message) throw makeError(errorCodes.NOT_FOUND, 'No message matches that id.');
  if (message.channel !== 'email') throw makeError(errorCodes.VALIDATION_ERROR, 'Only emails can be retried.');
  if (!['failed', 'not_configured', 'skipped'].includes(message.status)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Only a failed or unsent email can be retried.');
  }

  const customer = message.customer ? await Customer.findById(message.customer) : null;
  const to = customer?.email?.trim() || message.to;
  if (!validEmail(to)) throw makeError(errorCodes.VALIDATION_ERROR, 'The customer still has no valid email address.');
  if (!emailConfigured()) throw makeError(errorCodes.VALIDATION_ERROR, 'Email sending is not set up on the server.');

  message.to = to;
  message.status = 'pending';
  message.attempts = 0;
  message.lastError = '';
  await message.save();
  return (await deliverMessage(message._id)).toApiJson();
}

/** A person contacted the customer another way; record that instead of sending. */
export async function markMessageManual(id, note) {
  const message = await MessageDelivery.findById(id);
  if (!message) throw makeError(errorCodes.NOT_FOUND, 'No message matches that id.');
  if (message.status === 'sent') throw makeError(errorCodes.VALIDATION_ERROR, 'This message was already sent.');
  const text = String(note ?? '').trim();
  if (text.length < 3) throw makeError(errorCodes.VALIDATION_ERROR, 'Write how the customer was contacted.');
  message.status = 'manual';
  message.manualNote = text.slice(0, 400);
  message.nextAttemptAt = null;
  await message.save();
  return message.toApiJson();
}

export async function listMessagesForComplaint(complaintId) {
  const rows = await MessageDelivery.find({ complaint: complaintId }).sort({ createdAt: -1 });
  return rows.map((row) => row.toApiJson());
}

export async function listMessagesForCustomer(customerId) {
  const rows = await MessageDelivery.find({ customer: customerId }).sort({ createdAt: -1 });
  return rows.map((row) => row.toApiJson());
}
