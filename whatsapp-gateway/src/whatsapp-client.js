import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber ?? '').replace(/\D/g, '');
}

export function createWhatsAppClient({
  authDirectory = path.resolve(moduleDirectory, '../../auth_info'),
  messageDelayMs = 1500,
} = {}) {
  let socket = null;
  let connected = false;
  let reconnectTimer = null;
  let stopping = false;
  let sendQueue = Promise.resolve();
  let lastSentAt = 0;

  async function connect() {
    if (stopping) return;

    await mkdir(authDirectory, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
    let version;

    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch (error) {
      console.warn('[whatsapp] Could not fetch the latest Baileys version; using defaults.', error.message);
    }

    socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, console),
      },
      ...(version ? { version } : {}),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('[whatsapp] Scan this QR code with WhatsApp > Linked devices:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        connected = true;
        console.log('[whatsapp] Connected.');
      }

      if (connection === 'close') {
        connected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        socket = null;

        if (stopping || statusCode === DisconnectReason.loggedOut) {
          if (statusCode === DisconnectReason.loggedOut) {
            console.error('[whatsapp] Session was logged out. Delete auth_info and scan a new QR code.');
          }
          return;
        }

        const reconnectInMs = 5000;
        console.warn(`[whatsapp] Connection closed. Reconnecting in ${reconnectInMs / 1000}s.`);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect().catch((error) => {
            console.error('[whatsapp] Reconnect failed:', error);
          });
        }, reconnectInMs);
      }
    });
  }

  function enqueue(operation) {
    const result = sendQueue.then(operation);
    sendQueue = result.catch(() => undefined);
    return result;
  }

  function assertConnected() {
    if (!connected || !socket) {
      const error = new Error('WhatsApp is not connected.');
      error.code = 'WHATSAPP_NOT_READY';
      throw error;
    }
  }

  async function verifyAndSend(phoneNumber, message) {
    return enqueue(async () => {
      assertConnected();

      const jid = `${phoneNumber}@s.whatsapp.net`;
      const matches = await socket.onWhatsApp(jid);
      const account = matches?.find((match) => match?.exists);

      if (!account) {
        return { exists: false };
      }

      const elapsed = Date.now() - lastSentAt;
      if (elapsed < messageDelayMs) {
        await delay(messageDelayMs - elapsed);
      }

      assertConnected();
      await socket.sendMessage(account.jid ?? jid, { text: message });
      lastSentAt = Date.now();
      return { exists: true };
    });
  }

  async function start() {
    stopping = false;
    await connect();
  }

  async function stop() {
    stopping = true;
    connected = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.ws?.close();
      socket = null;
    }
  }

  return {
    start,
    stop,
    verifyAndSend,
    isConnected: () => connected,
  };
}
