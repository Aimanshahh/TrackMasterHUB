import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';

export const INVOICE_STATUSES = ['draft', 'issued', 'cancelled'];
export const PAYMENT_STATES = ['unpaid', 'partial', 'paid', 'overdue'];

/**
 * One invoice per installation. It is drafted with the amount the job was sold
 * at, then issued by the manager. Money never edits the invoice: payments are
 * appended as their own records and `paidAmount` is the running total, so a
 * partial payment is visible as history rather than overwriting a figure.
 */
const invoiceSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
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
    /** An invoice belongs to the installation it bills. */
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      index: true,
    },
    jobReference: {
      type: String,
      trim: true,
    },
    vehicle: {
      label: { type: String, trim: true, maxlength: 120 },
      registration: { type: String, trim: true, maxlength: 60 },
    },
    packageKey: {
      type: String,
      enum: PACKAGE_KEYS,
      default: null,
    },
    /** The package rate at the time of sale, kept for audit. */
    listPrice: {
      type: Number,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'PKR',
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'draft',
      index: true,
    },
    dueDate: {
      type: Date,
    },
    issuedAt: {
      type: Date,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 400,
    },
  },
  { timestamps: true },
);

invoiceSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('INV');
  next();
});

invoiceSchema.methods.balance = function () {
  return Math.max(0, Math.round((this.amount - this.paidAmount) * 100) / 100);
};

/** Payment state is derived, never typed in by staff. */
invoiceSchema.methods.paymentState = function () {
  if (this.status === 'cancelled') return 'cancelled';
  if (this.paidAmount >= this.amount) return 'paid';
  if (this.paidAmount > 0) {
    return this.dueDate && this.dueDate < new Date() ? 'overdue' : 'partial';
  }
  return this.dueDate && this.dueDate < new Date() && this.status === 'issued' ? 'overdue' : 'unpaid';
};

invoiceSchema.methods.toApiJson = function () {
  const populated = (value) => Boolean(value && typeof value === 'object' && value._id);

  return {
    id: this._id.toString(),
    reference: this.reference,
    customer: populated(this.customer)
      ? { id: this.customer._id.toString(), name: this.customer.name, phone: this.customer.phone ?? '' }
      : { id: this.customer?.toString() ?? '', name: this.customerName ?? '', phone: '' },
    job: populated(this.job)
      ? { id: this.job._id.toString(), reference: this.job.reference, status: this.job.status }
      : { id: this.job?.toString() ?? '', reference: this.jobReference ?? '', status: '' },
    vehicle: {
      label: this.vehicle?.label ?? '',
      registration: this.vehicle?.registration ?? '',
    },
    packageKey: this.packageKey ?? null,
    packageName: this.packageKey ? packageCatalog[this.packageKey]?.name ?? this.packageKey : '',
    listPrice: this.listPrice ?? null,
    amount: this.amount,
    paidAmount: Math.round(this.paidAmount * 100) / 100,
    balance: this.balance(),
    currency: this.currency ?? 'PKR',
    status: this.status,
    paymentState: this.paymentState(),
    dueDate: this.dueDate?.toISOString() ?? null,
    issuedAt: this.issuedAt?.toISOString() ?? null,
    paidAt: this.paidAt?.toISOString() ?? null,
    notes: this.notes ?? '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Invoice', invoiceSchema);
