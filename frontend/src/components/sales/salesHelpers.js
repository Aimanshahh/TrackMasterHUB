import { formatMoney } from '../../lib/format.js';

export { formatMoney };

export const APPROVAL_TEXT = {
  not_required: 'Standard price',
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function formatDay(value) {
  return value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—';
}

/** First number in a field that may hold several ("0300 1112233 / 0315 4445566"). */
export function firstNumber(phone) {
  return String(phone ?? '').split(/[/,;]/)[0].replace(/[^\d+]/g, '');
}

export function callLink(phone) {
  const number = firstNumber(phone);
  return number ? `tel:${number}` : null;
}

/** wa.me wants the country code with no plus or leading zero (Pakistan: 92). */
export function whatsappLink(phone) {
  let number = firstNumber(phone).replace(/^\+/, '');
  if (!number) return null;
  if (number.startsWith('00')) number = number.slice(2);
  else if (number.startsWith('0')) number = `92${number.slice(1)}`;
  return `https://wa.me/${number}`;
}

export function renewalText(row) {
  if (row.state === 'expired') return `Expired ${Math.abs(row.daysLeft)} ${Math.abs(row.daysLeft) === 1 ? 'day' : 'days'} ago`;
  return row.daysLeft === 0 ? 'Expires today' : `Expires in ${row.daysLeft} ${row.daysLeft === 1 ? 'day' : 'days'}`;
}

