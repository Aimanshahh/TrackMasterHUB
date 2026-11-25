import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

/**
 * A discount request for an installation. Created only by the backend when a
 * salesperson quotes below the admin's package rate; the salesperson can never
 * approve their own price.
 */
const approvalSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    packageKey: {
      type: String,
      required: true,
      enum: PACKAGE_KEYS,
    },
    listPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    /** The minimum price in force when the sale was quoted. Kept for the record. */
    minimumPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    quotedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: APPROVAL_STATUSES,
      default: 'pending',
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
      type: Date,
    },
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

approvalSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('APR');
  next();
});

approvalSchema.methods.toApiJson = function () {
  const job = this.job;
  const customer = this.customer;
  const populated = (value) => Boolean(value && typeof value === 'object' && value._id);

  return {
    id: this._id.toString(),
    reference: this.reference,
    status: this.status,
    packageKey: this.packageKey,
    packageName: packageCatalog[this.packageKey]?.name ?? this.packageKey,
    listPrice: this.listPrice,
    minimumPrice: this.minimumPrice ?? null,
    quotedPrice: this.quotedPrice,
    discount: Math.max(0, Math.round((this.listPrice - this.quotedPrice) * 100) / 100),
    belowMinimum: this.minimumPrice !== null && this.minimumPrice !== undefined
      ? this.quotedPrice < this.minimumPrice
      : false,
    reason: this.reason ?? '',
    decisionNote: this.decisionNote ?? '',
    requestedBy: populated(this.requestedBy)
      ? { id: this.requestedBy._id.toString(), name: this.requestedBy.name, role: this.requestedBy.role }
      : null,
    decidedBy: populated(this.decidedBy)
      ? { id: this.decidedBy._id.toString(), name: this.decidedBy.name }
      : null,
    job: populated(job)
      ? {
        id: job._id.toString(),
        reference: job.reference,
        status: job.status,
        vehicle: {
          label: job.vehicle?.label ?? '',
          registration: job.vehicle?.registration ?? '',
          station: job.vehicle?.station ?? '',
        },
      }
      : { id: job?.toString() ?? '', reference: '', status: '', vehicle: {} },
    customer: populated(customer)
      ? { id: customer._id.toString(), name: customer.name, phone: customer.phone ?? '' }
      : { id: customer?.toString() ?? '', name: '', phone: '' },
    decidedAt: this.decidedAt?.toISOString() ?? null,
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('Approval', approvalSchema);
