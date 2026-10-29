/** Shared operational reference values for the operations workspace. */

export const JOB_STATUS_OPTIONS = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const COMPLAINT_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_customer', label: 'Waiting for customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const COMPLAINT_CATEGORIES = ['Installation', 'Device', 'Tracking', 'Billing', 'Service', 'Other'];

export const STOCK_STATUS_OPTIONS = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'assigned', label: 'With technician' },
  { value: 'out_of_service', label: 'Out of service' },
];

export function statusTone(status) {
  if (['completed', 'resolved', 'closed'].includes(status)) return 'done';
  if (['in_progress', 'scheduled', 'waiting_customer'].includes(status)) return 'active';
  if (['cancelled', 'out_of_service'].includes(status)) return 'muted';
  if (status === 'assigned') return 'info';
  return 'idle';
}

export function priorityTone(priority) {
  if (priority === 'urgent' || priority === 'high') return 'high';
  if (priority === 'low') return 'muted';
  return 'idle';
}

export function formatDay(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDayTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function requestTypeLabel(type) {
  return type === 'follow_up' ? 'Follow-up' : 'New installation';
}
