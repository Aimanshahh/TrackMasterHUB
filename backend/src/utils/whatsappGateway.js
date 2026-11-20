import axios from 'axios';
import { env } from '../config/env.js';

export function normalizeWhatsAppPhoneNumber(phoneNumber) {
  return String(phoneNumber ?? '').replace(/\D/g, '');
}

const failureText = (error) => String(
  (axios.isAxiosError(error) ? error.response?.data?.error ?? error.message : error?.message ?? error) || 'The WhatsApp gateway could not send the message.',
).slice(0, 300);

/**
 * One message through the gateway, with the reason when it fails. Never throws,
 * so a gateway problem cannot break the request or record that asked for it.
 * The gateway takes { phoneNumber, customerName, message }.
 */
export async function postToWhatsAppGateway(phoneNumber, customerName, message) {
  const normalizedPhoneNumber = normalizeWhatsAppPhoneNumber(phoneNumber);
  if (!normalizedPhoneNumber) return { ok: false, error: 'The customer has no valid phone number.' };
  if (!env.whatsappGatewayUrl) return { ok: false, error: 'WhatsApp gateway is not configured on the server.', notConfigured: true };

  try {
    await axios.post(
      env.whatsappGatewayUrl,
      { phoneNumber: normalizedPhoneNumber, customerName, message },
      { headers: { 'x-api-key': env.whatsappGatewayApiKey }, timeout: env.whatsappGatewayTimeoutMs },
    );
    return { ok: true, error: '' };
  } catch (error) {
    const detail = failureText(error);
    console.error('[whatsapp-gateway] Update failed:', detail);
    return { ok: false, error: detail };
  }
}

/**
 * Sends a customer update without allowing gateway failures to affect CRM
 * complaint persistence or the request that created/updated the complaint.
 */
export async function sendWhatsAppUpdate(phoneNumber, customerName, message) {
  const result = await postToWhatsAppGateway(phoneNumber, customerName, message);
  if (!result.ok && (result.notConfigured || /no valid phone/.test(result.error))) console.warn(`[whatsapp-gateway] Skipping update: ${result.error}`);
  return result.ok;
}

/**
 * Many messages, one after another. The gateway paces itself and limits each
 * minute, so this waits `delayMs` between sends instead of firing them together.
 * `onResult(item, result)` is called after every send.
 */
export async function sendWhatsAppBulk(items, { delayMs = env.whatsappBulkDelayMs, onResult } = {}) {
  const summary = { sent: 0, failed: 0 };
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const result = await postToWhatsAppGateway(item.phoneNumber, item.customerName, item.message);
    if (result.ok) summary.sent += 1; else summary.failed += 1;
    if (onResult) await onResult(item, result);
    if (delayMs > 0 && i < items.length - 1) await new Promise((resolve) => { setTimeout(resolve, delayMs); });
  }
  return summary;
}
