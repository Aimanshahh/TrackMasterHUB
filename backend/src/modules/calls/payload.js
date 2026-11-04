/**
 * Turns whatever the robocall provider posts into one call record. Providers
 * name the same field differently, so each value is looked up under several
 * likely names (case and punctuation ignored). The untouched payload is stored
 * next to the result, so a field that is not recognised is never lost.
 */
const norm = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(body, names) {
  const wanted = new Set(names.map(norm));
  for (const [key, value] of Object.entries(body ?? {})) {
    if (wanted.has(norm(key)) && value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

export function mapStatus(value) {
  const text = String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (['answered', 'answer', 'completed', 'success', 'connected'].includes(text)) return 'answered';
  if (['noanswer', 'unanswered', 'missed', 'notanswered', 'failed', 'timeout'].includes(text)) return 'no_answer';
  if (text === 'busy') return 'busy';
  return 'other';
}

function parseTime(value) {
  if (value === undefined) return new Date();
  if (/^\d{10,13}$/.test(String(value))) {
    const n = Number(value);
    return new Date(String(value).length === 10 ? n * 1000 : n);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseAmount(value) {
  if (value === undefined) return null;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Returns the mapped record, or null when the payload carries no call id and no number (nothing to store). */
export function parseCallPayload(body) {
  const calledNumber = pick(body, ['call_to', 'to', 'number', 'phone', 'destination', 'callee', 'msisdn']);
  const providerCallId = pick(body, ['call_id', 'id', 'uuid', 'call_uuid', 'callsid', 'sid']);
  if (providerCallId === undefined && calledNumber === undefined) return null;

  const providerStatus = pick(body, ['status', 'call_status', 'state', 'result']);
  const calledAt = parseTime(pick(body, ['time', 'timestamp', 'called_at', 'created_at', 'date', 'start_time']));

  return {
    // Without a provider id, the number plus the call time still identifies a delivery.
    callId: String(providerCallId ?? `${calledNumber}@${calledAt.toISOString()}`),
    calledNumber: String(calledNumber ?? ''),
    status: mapStatus(providerStatus),
    providerStatus: String(providerStatus ?? ''),
    durationSeconds: Math.max(0, Math.round(Number(String(pick(body, ['duration', 'call_duration', 'billsec', 'seconds']) ?? 0).replace(/[^0-9.]/g, '')) || 0)),
    dtmf: String(pick(body, ['dtmf', 'digits', 'key_pressed', 'keypress', 'input']) ?? ''),
    alertId: String(pick(body, ['alert_id', 'alertid']) ?? ''),
    alertType: String(pick(body, ['alert_type', 'alerttype', 'city']) ?? ''),
    amount: parseAmount(pick(body, ['amount', 'cost', 'price', 'charge'])),
    calledAt,
  };
}
