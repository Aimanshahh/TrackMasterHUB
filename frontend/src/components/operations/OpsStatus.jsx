import { priorityTone, statusTone } from '../../app/operations.js';

export function StatusPill({ status, label }) {
  return <span className="ops-status" data-tone={statusTone(status)}>{label ?? status}</span>;
}

export function PriorityTag({ priority }) {
  return <span className="ops-priority" data-tone={priorityTone(priority)}>{priority}</span>;
}

export function StockStatus({ status }) {
  const labels = { in_stock: 'In stock', assigned: 'With technician', out_of_service: 'Out of service' };
  return <span className="ops-status" data-tone={statusTone(status)}>{labels[status] ?? status}</span>;
}
