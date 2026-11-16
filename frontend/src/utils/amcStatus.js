const DAY_MS = 86_400_000;

export function getAmcStatus(expiryDate, trackingStatus = '', now = new Date()) {
  if (expiryDate === null || expiryDate === undefined || expiryDate === '') {
    return { label: 'Unknown', color: 'gray', daysRemaining: null, daysExpired: null, expiryDate: null };
  }

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime()) || /^0{4}-0{2}-0{2}/.test(String(expiryDate))) {
    return { label: 'Unknown', color: 'gray', daysRemaining: null, daysExpired: null, expiryDate: null };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  const daysExpired = Math.floor((today.getTime() - expiry.getTime()) / DAY_MS);
  const daysRemaining = Math.max(0, -daysExpired);
  const result = (label, color) => ({ label, color, daysRemaining, daysExpired: Math.max(0, daysExpired), expiryDate: expiry.toISOString() });

  if (daysExpired > 0) return result('Expired', 'red');
  if (['inactive', 'unknown', 'not_tracked'].includes(trackingStatus)) return result('Active (No Tracker)', 'orange');
  if (daysRemaining < 30) return result('Expiring Soon', 'yellow');
  return result('Active', 'green');
}
