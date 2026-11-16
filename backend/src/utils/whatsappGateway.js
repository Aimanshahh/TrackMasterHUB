import axios from 'axios';
import { env } from '../config/env.js';

export function normalizeWhatsAppPhoneNumber(phoneNumber) {
  return String(phoneNumber ?? '').replace(/\D/g, '');
}

/**
 * Sends a customer update without allowing gateway failures to affect CRM
 * complaint persistence or the request that created/updated the complaint.
 */
export async function sendWhatsAppUpdate(phoneNumber, customerName, message) {
  const normalizedPhoneNumber = normalizeWhatsAppPhoneNumber(phoneNumber);

  if (!normalizedPhoneNumber) {
    console.warn('[whatsapp-gateway] Skipping update: customer has no valid phone number.');
    return false;
  }

  if (!env.whatsappGatewayUrl) {
    console.warn('[whatsapp-gateway] Skipping update: WHATSAPP_GATEWAY_URL is not configured.');
    return false;
  }

  try {
    await axios.post(
      env.whatsappGatewayUrl,
      {
        phoneNumber: normalizedPhoneNumber,
        customerName,
        message,
      },
      {
        headers: {
          'x-api-key': env.whatsappGatewayApiKey,
        },
        timeout: env.whatsappGatewayTimeoutMs,
      },
    );
    return true;
  } catch (error) {
    const detail = axios.isAxiosError(error)
      ? error.response?.data?.error ?? error.message
      : error;
    console.error('[whatsapp-gateway] Update failed:', detail);
    return false;
  }
}
