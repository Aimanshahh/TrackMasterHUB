import { env } from '../config/env.js';

/**
 * The values a template can use. Each one says where it comes from, and whether
 * it is a secret that must not be kept in the message log.
 */
export const TEMPLATE_VARIABLES = [
  { name: 'Customer Name', secret: false, read: (customer) => customer.name },
  { name: 'Customer Phone', secret: false, read: (customer) => customer.phone },
  { name: 'Helpline Number', secret: false, read: () => env.helplineNumber },
  { name: 'Login Email', secret: false, read: (customer) => customer.appLogin },
  { name: 'Password', secret: true, read: (customer) => customer.appPassword },
];

/** Shown on the screen when a value is missing, so staff know what to fix. */
export const MISSING_HINTS = {
  'Customer Name': 'the customer has no name',
  'Customer Phone': 'the customer has no phone number',
  'Helpline Number': 'the helpline number is not set on the server (HELPLINE_NUMBER)',
  'Login Email': 'this customer has no app login saved',
  Password: 'this customer has no app password saved',
};

export const DEFAULT_TEMPLATES = [
  { key: 'helpline-numbers', name: 'Helpline Numbers', body: 'Hi [Customer Name], for support call [Helpline Number].' },
  { key: 'login-details', name: 'Login Details', body: 'Hi [Customer Name], your app login is [Login Email] and password is [Password].' },
];

const PLACEHOLDER = /\[([^\]\n]{1,40})\]/g;
const byName = new Map(TEMPLATE_VARIABLES.map((variable) => [variable.name.toLowerCase(), variable]));

/** Every [Placeholder] in the text, as the variable it names (or null when it names nothing known). */
export function placeholdersIn(body) {
  return [...String(body ?? '').matchAll(PLACEHOLDER)].map((match) => ({ raw: match[0], variable: byName.get(match[1].trim().toLowerCase()) ?? null }));
}

/**
 * Fill a template for one customer.
 * Returns the real text to send, a copy with secrets hidden for the message log,
 * and the list of values that were missing.
 */
export function renderTemplate(body, customer) {
  const missing = [];
  const fill = (text, { hideSecrets }) => String(text).replace(PLACEHOLDER, (raw, inner) => {
    const variable = byName.get(inner.trim().toLowerCase());
    if (!variable) return raw;
    const value = String(variable.read(customer) ?? '').trim();
    if (!value) {
      if (!missing.includes(variable.name)) missing.push(variable.name);
      return raw;
    }
    return hideSecrets && variable.secret ? '••••••' : value;
  });
  return { text: fill(body, { hideSecrets: false }), logText: fill(body, { hideSecrets: true }), missing };
}

export const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
