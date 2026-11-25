import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';

export const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'rejected'];
export const QUOTATION_STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

/**
 * A priced offer given to a customer before the sale exists. It is a record of
 * what was promised and when it stops being valid, so a quotation is never
 * edited once it has been sent: a price change makes the next version instead,
 * and the earlier figures stay in `history`.
 */
const quotationSchema = new mongoose.Schema(
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
    customerPhone: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    /** Filled when the quote is raised against a known installation request. */
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
      required: true,
    },
    /** The package rate when the quote was written, kept so a change is visible. */
    listPrice: {
      type: Number,
      default: null,
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
    status: {
      type: String,
      enum: QUOTATION_STATUSES,
      default: 'draft',
      index: true,
    },
    /** Last day the price holds. A sent quote past this date reads as Expired. */
    validUntil: {
      type: Date,
      required: true,
    },
    terms: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    /** Earlier versions, newest last, kept as plain figures for audit. */
    history: [
      {
        _id: false,
        version: Number,
        amount: Number,
        listPrice: { type: Number, default: null },
        packageKey: String,
        validUntil: Date,
        terms: { type: String, default: '' },
        notes: { type: String, default: '' },
        recordedAt: Date,
        recordedBy: mongoose.Schema.Types.ObjectId,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    sentAt: Date,
    decidedAt: Date,
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

quotationSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('QTN');
  next();
});

/** A quote stops being usable at the end of its last valid day. */
quotationSchema.methods.isExpired = function (now = new Date()) {
  if (this.status !== 'sent') return false;
  const end = new Date(this.validUntil);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < now.getTime();
};

quotationSchema.methods.effectiveStatus = function (now = new Date()) {
  return this.isExpired(now) ? 'expired' : this.status;
};

quotationSchema.methods.toApiJson = function (now = new Date()) {
  const populatedCustomer = Boolean(this.customer && typeof this.customer === 'object' && this.customer.name);
  const populatedJob = Boolean(this.job && typeof this.job === 'object' && this.job.reference);
  const populatedUser = Boolean(this.createdBy && typeof this.createdBy === 'object' && this.createdBy.name);
  const effective = this.effectiveStatus(now);

  return {
    id: this._id.toString(),
    reference: this.reference,
    customer: {
      id: populatedCustomer ? this.customer._id.toString() : this.customer?.toString() ?? '',
      name: populatedCustomer ? this.customer.name : this.customerName ?? '',
      phone: populatedCustomer ? this.customer.phone ?? '' : this.customerPhone ?? '',
    },
    job: this.job
      ? {
        id: populatedJob ? this.job._id.toString() : this.job.toString(),
        reference: populatedJob ? this.job.reference : this.jobReference ?? '',
      }
      : null,
    vehicle: {
      label: this.vehicle?.label ?? '',
      registration: this.vehicle?.registration ?? '',
    },
    packageKey: this.packageKey,
    packageName: packageCatalog[this.packageKey]?.name ?? this.packageKey,
    packageSummary: packageCatalog[this.packageKey]?.summary ?? '',
    listPrice: this.listPrice ?? null,
    amount: this.amount,
    /** The discount against the package rate, in the customer's favour. */
    discount: this.listPrice !== null && this.listPrice > this.amount ? Math.round((this.listPrice - this.amount) * 100) / 100 : 0,
    currency: this.currency ?? 'PKR',
    status: this.status,
    effectiveStatus: effective,
    statusLabel: QUOTATION_STATUS_LABELS[effective] ?? effective,
    validUntil: this.validUntil?.toISOString() ?? null,
    terms: this.terms ?? '',
    notes: this.notes ?? '',
    version: this.version ?? 1,
    history: (this.history ?? []).map((entry) => ({
      version: entry.version,
      amount: entry.amount,
      listPrice: entry.listPrice ?? null,
      packageKey: entry.packageKey,
      validUntil: entry.validUntil?.toISOString() ?? null,
      recordedAt: entry.recordedAt?.toISOString() ?? null,
    })),
    createdBy: populatedUser
      ? { id: this.createdBy._id.toString(), name: this.createdBy.name }
      : null,
    sentAt: this.sentAt?.toISOString() ?? null,
    decidedAt: this.decidedAt?.toISOString() ?? null,
    decisionNote: this.decisionNote ?? '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Quotation', quotationSchema);
