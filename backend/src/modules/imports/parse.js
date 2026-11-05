import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';

import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

export const MAX_ROWS = 5000;
export const MAX_BYTES = 8 * 1024 * 1024;

const bad = (message) => makeError(errorCodes.VALIDATION_ERROR, message);

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return cellText(value.text);
    if ('hyperlink' in value) return String(value.hyperlink);
    return '';
  }
  return String(value).trim();
}

/** Identify the file by its first bytes, not just its name: .xlsx files are zip archives. */
export function detectType(buffer, fileName = '') {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const lower = String(fileName).toLowerCase();
  if (isZip) return 'xlsx';
  if (lower.endsWith('.xlsx')) throw bad('This .xlsx file could not be read. Open it in Excel and save it again as .xlsx.');
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  throw bad('Upload an Excel (.xlsx) or CSV (.csv) file.');
}

async function readXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw bad('This Excel file could not be read. Save it again as .xlsx and retry.');
  }
  const sheet = workbook.worksheets.find((candidate) => candidate.actualRowCount > 0);
  if (!sheet) throw bad('The Excel file has no data.');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = [];
    for (let c = 1; c <= sheet.actualColumnCount; c += 1) cells.push(cellText(row.getCell(c).value));
    rows.push(cells);
  });
  return rows;
}

function readCsv(buffer) {
  try {
    return parseCsv(buffer, { bom: true, relax_column_count: true, skip_empty_lines: true, trim: true, relax_quotes: true });
  } catch (error) {
    throw bad(`The CSV file could not be read: ${error.message}`);
  }
}

/** Returns the header row and the data rows as arrays aligned to the headers. */
export async function parseUpload(buffer, fileName) {
  if (!buffer?.length) throw bad('The file is empty.');
  if (buffer.length > MAX_BYTES) throw bad('The file is larger than 8 MB. Split it into smaller files.');

  const type = detectType(buffer, fileName);
  const all = type === 'xlsx' ? await readXlsx(buffer) : readCsv(buffer);
  const nonEmpty = all.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length < 2) throw bad('The file needs a header row and at least one data row.');

  const width = Math.max(...nonEmpty.map((row) => row.length));
  const seen = new Map();
  const headers = Array.from({ length: width }, (_, i) => {
    const raw = String(nonEmpty[0][i] ?? '').trim() || `Column ${i + 1}`;
    const count = (seen.get(raw) ?? 0) + 1;
    seen.set(raw, count);
    return count > 1 ? `${raw} (${count})` : raw;
  });

  const data = nonEmpty.slice(1);
  if (data.length > MAX_ROWS) throw bad(`The file has ${data.length} rows. Import at most ${MAX_ROWS} at a time.`);

  return {
    type,
    headers,
    rows: data.map((row, index) => ({ n: index + 2, cells: headers.map((_, i) => String(row[i] ?? '').trim()) })),
  };
}
