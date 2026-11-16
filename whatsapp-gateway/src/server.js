import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createWhatsAppClient, normalizePhoneNumber } from './whatsapp-client.js';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4100);
const webhookApiKey = (process.env.WEBHOOK_API_KEY ?? '').trim();
const messageDelayMs = Math.max(1000, Number(process.env.MESSAGE_DELAY_MS ?? 1500));
const authDirectory = path.resolve(
  moduleDirectory,
  process.env.AUTH_DIRECTORY ?? '../auth_info',
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

if (process.env.NODE_ENV === 'production' && !webhookApiKey) {
  throw new Error('WEBHOOK_API_KEY must be configured in production.');
}

if (!webhookApiKey) {
  console.warn('[gateway] WEBHOOK_API_KEY is not configured; webhook authentication is disabled.');
}

const whatsapp = createWhatsAppClient({ authDirectory, messageDelayMs });
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, whatsappConnected: whatsapp.isConnected() });
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

function requireWebhookApiKey(req, res, next) {
  if (!webhookApiKey) {
    next();
    return;
  }

  const providedKey = req.get('x-api-key') ?? '';
  const expected = Buffer.from(webhookApiKey);
  const received = Buffer.from(providedKey);
  const valid =
    expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!valid) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  next();
}

app.post('/api/send-update', webhookLimiter, requireWebhookApiKey, async (req, res) => {
  const { phoneNumber, message } = req.body ?? {};
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

  if (
    !normalizedPhoneNumber ||
    normalizedPhoneNumber.length < 8 ||
    normalizedPhoneNumber.length > 15 ||
    typeof message !== 'string' ||
    !message.trim()
  ) {
    res.status(400).json({
      success: false,
      error: 'phoneNumber and a non-empty message are required',
    });
    return;
  }

  if (!whatsapp.isConnected()) {
    res.status(503).json({ success: false, error: 'WhatsApp is not connected' });
    return;
  }

  try {
    const result = await whatsapp.verifyAndSend(normalizedPhoneNumber, message.trim());

    if (!result.exists) {
      res.status(404).json({ success: false, error: 'Number not on WhatsApp' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[gateway] WhatsApp send failed:', error);
    const status = error.code === 'WHATSAPP_NOT_READY' ? 503 : 502;
    res.status(status).json({
      success: false,
      error: status === 503 ? 'WhatsApp is not connected' : 'Failed to send WhatsApp message',
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ success: false, error: 'Invalid JSON body' });
    return;
  }
  console.error('[gateway] Unhandled request error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`[gateway] Listening on http://localhost:${port}`);
});

whatsapp.start().catch((error) => {
  console.error('[gateway] WhatsApp startup failed:', error);
});

async function shutdown(signal) {
  console.log(`[gateway] ${signal} received; shutting down.`);
  await whatsapp.stop();
  server.close((error) => {
    if (error) {
      console.error('[gateway] HTTP shutdown failed:', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
