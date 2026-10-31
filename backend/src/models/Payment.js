import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'card', 'online', 'other'];

export const paymentMethodLabels = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  card: 'Card',
  online: 'Online',
  other: 'Other',
};

/**
 * An append-only money record. A customer may settle an installation in parts,
 * so each installment is its own payment row pointing at the same invoice; the
 * invoice total is never rewritten to reflect a part payment.
 */
const paymentSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    /** Bank reference, cheque number, transaction id — whatever proves it. */
    transactionRef: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 400,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

paymentSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('PAY');
  next();
});

paymentSchema.methods.toApiJson = function () {
  const populated = (value) => Boolean(value && typeof value === 'object' && value._id);
  const invoice = this.invoice;

  return {
    id: this._id.toString(),
    reference: this.reference,
    invoice: populated(invoice)
      ? { id: invoice._id.toString(), reference: invoice.reference, amount: invoice.amount }
      : { id: invoice?.toString() ?? '', reference: '', amount: null },
    customer: populated(this.customer)
      ? { id: this.customer._id.toString(), name: this.customer.name, phone: this.customer.phone ?? '' }
      : { id: this.customer?.toString() ?? '', name: this.customerName ?? '', phone: '' },
    amount: this.amount,
    currency: this.currency ?? 'PKR',
    method: this.method,
    methodLabel: paymentMethodLabels[this.method] ?? this.method,
    transactionRef: this.transactionRef ?? '',
    receivedAt: this.receivedAt?.toISOString() ?? this.createdAt.toISOString(),
    note: this.note ?? '',
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('Payment', paymentSchema);
