/** 5 Nov 2026 — the way dates are written across the app. */
export function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

/** The yyyy-mm-dd string a date input expects. */
export function toInputDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}
