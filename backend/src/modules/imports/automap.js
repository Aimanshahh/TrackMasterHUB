import { IMPORT_FIELDS } from './fields.js';

const norm = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Suggest which file column feeds which field. Exact matches on a known name win;
 * a column is never offered to two fields. Anything uncertain is left empty for
 * the person to choose.
 */
export function suggestMapping(headers) {
  const normalized = headers.map(norm);
  const used = new Set();
  const mapping = {};

  const claim = (field, index) => { mapping[field.key] = headers[index]; used.add(index); };

  // Pass 1: exact synonym match (most specific synonyms first).
  for (const field of IMPORT_FIELDS) {
    for (const synonym of field.synonyms.map(norm)) {
      const index = normalized.findIndex((h, i) => !used.has(i) && h === synonym);
      if (index !== -1) { claim(field, index); break; }
    }
  }

  // Pass 2: the header contains a long-enough synonym (for example "Customer Mobile No.").
  for (const field of IMPORT_FIELDS) {
    if (mapping[field.key]) continue;
    for (const synonym of field.synonyms.map(norm).filter((s) => s.length >= 4)) {
      const index = normalized.findIndex((h, i) => !used.has(i) && h.includes(synonym));
      if (index !== -1) { claim(field, index); break; }
    }
  }

  return mapping;
}
