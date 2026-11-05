import { phoneKey } from '../../utils/phone.js';
import { FIELD_KEYS } from './fields.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export const plateKey = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Accepts 2026-09-25, 25-09-2026, 25/09/2026, 25.9.2026 and 25-Sep-2026. Returns a UTC date or null. */
export function parseDateText(text) {
  const value = String(text ?? '').trim();
  if (!value) return null;
  let y; let m; let d;
  let match;
  if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) { [y, m, d] = [match[1], match[2] - 1, match[3]]; }
  else if ((match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { [d, m, y] = [match[1], match[2] - 1, match[3]]; }
  else if ((match = value.match(/^(\d{1,2})[-/ .]([A-Za-z]{3})[A-Za-z]*[-/ .,]+(\d{4})$/))) { [d, m, y] = [match[1], MONTHS[match[2].toLowerCase()], match[3]]; }
  else return null;
  if (m === undefined || Number.isNaN(Number(m))) return null;
  const date = new Date(Date.UTC(Number(y), Number(m), Number(d)));
  const valid = date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) && date.getUTCDate() === Number(d);
  return valid ? date : null;
}

/**
 * Turn one file row into clean values plus problems. `mapping` is
 * { fieldKey: headerName }. Unmapped, non-empty columns are returned in `extra`
 * so nothing from the legacy file is thrown away.
 */
export function normalizeRow(cells, headers, mapping, now = new Date()) {
  const col = (key) => {
    const header = mapping[key];
    if (!header) return '';
    const index = headers.indexOf(header);
    return index === -1 ? '' : String(cells[index] ?? '').trim();
  };

  const values = {};
  for (const key of FIELD_KEYS) values[key] = col(key);

  const errors = [];
  const warnings = [];

  if (!values.name) warnings.push('Customer name is missing. A temporary name will be used until you edit the customer.');
  const key = phoneKey(values.phone);
  if (!values.phone) warnings.push('Phone number is missing.');
  else if (!key) {
    warnings.push(`Phone number "${values.phone}" is not usable and will be left blank.`);
    values.phone = '';
  }
  values.phoneKey = key;

  if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    warnings.push(`Email "${values.email}" is not valid and will be left blank.`);
    values.email = '';
  }

  const vehicleFields = ['registration', 'makeModel', 'engineNo', 'chassisNo', 'colour', 'deviceImei', 'simNumber', 'installedAt'];
  const hasVehicle = vehicleFields.some((field) => values[field]);
  values.plateKey = plateKey(values.registration);
  if (hasVehicle && values.plateKey.length < 3) warnings.push('Vehicle details were found without a usable registration number; this vehicle will need editing before it can be added.');

  const imeiDigits = values.deviceImei.replace(/\D/g, '');
  if (values.deviceImei && (imeiDigits.length < 14 || imeiDigits.length > 17)) {
    warnings.push(`IMEI "${values.deviceImei}" is not valid and will be left blank.`);
    values.deviceImei = '';
  }
  if (values.deviceImei) values.deviceImei = imeiDigits;

  values.installedDate = null;
  if (values.installedAt) {
    const date = parseDateText(values.installedAt);
    if (!date) warnings.push(`Installation date "${values.installedAt}" is not readable and will be left blank.`);
    else if (date > now) warnings.push('The installation date is in the future and will be left blank.');
    else values.installedDate = date;
  }
  if (hasVehicle && values.plateKey && !values.installedAt) warnings.push('No installation date. The certificate date will need to be set by hand.');

  values.hasVehicle = hasVehicle && values.plateKey.length >= 3;

  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
  const extra = {};
  headers.forEach((header, index) => {
    if (!mappedHeaders.has(header) && String(cells[index] ?? '').trim()) extra[header] = String(cells[index]).trim();
  });

  return { values, errors, warnings, extra };
}
