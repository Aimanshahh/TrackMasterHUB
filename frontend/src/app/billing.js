/** Reference values and small helpers shared by the money screens. */

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

export const INVOICE_FILTERS = [
  { value: '', label: 'All invoices' },
  { value: 'draft', label: 'Not issued' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Part paid' },
  { value: 'paid', label: 'Settled' },
  { value: 'refund_due', label: 'Refund due' },
];

/** Payment states the invoice list can filter on. */
export const PAYMENT_STATE_FILTERS = ['unpaid', 'partial', 'paid', 'refund_due'];
