import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';
import { PAYMENT_METHODS, paymentMethodLabels } from './Payment.js';

export const ADJUSTMENT_KINDS = ['credit_note', 'refund'];

export const adjustmentKindLabels = {
  credit_note: 'Credit note',
  refund: 'Refund',
};

/**
 * An append-only correction to an issued invoice. Nothing here is ever edited or
 * deleted: a mistake is fixed by recording another entry.
 *
 *  - credit_note: reduces what the customer owes (for example a goodwill
 *    discount, or a service that was not delivered).
 *  - refund: money handed back to the customer. Only an overpayment can be
 *    refunded, which is why a credit note comes first.
 */
const adjustmentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    kind: { type: String, enum: ADJUSTMENT_KINDS, required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceReference: { type: String, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'PKR' },
    /** Why it was issued. Required, and part of the printed document. */
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 400 },
    /** Refunds only: how the money went back. */
    method: { type: String, enum: PAYMENT_METHODS },
    transactionRef: { type: String, trim: true, maxlength: 120 },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

adjustmentSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference(this.kind === 'refund' ? 'RFD' : 'CRN');
  next();
});

adjustmentSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    reference: this.reference,
    kind: this.kind,
    kindLabel: adjustmentKindLabels[this.kind] ?? this.kind,
    invoice: { id: this.invoice?._id ? this.invoice._id.toString() : this.invoice?.toString() ?? '', reference: this.invoiceReference ?? '' },
    customer: {
      id: this.customer?._id ? this.customer._id.toString() : this.customer?.toString() ?? '',
      name: this.customerName ?? '',
    },
    amount: this.amount,
    currency: this.currency ?? 'PKR',
    reason: this.reason,
    method: this.method ?? '',
    methodLabel: this.method ? paymentMethodLabels[this.method] ?? this.method : '',
    transactionRef: this.transactionRef ?? '',
    issuedAt: (this.issuedAt ?? this.createdAt).toISOString(),
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('InvoiceAdjustment', adjustmentSchema);
