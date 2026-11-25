import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'easypaisa', 'jazzcash', 'cheque', 'other'];

export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  easypaisa: 'Easypaisa',
  jazzcash: 'JazzCash',
  cheque: 'Cheque',
  other: 'Other',
};

/**
 * A payment made to a technician. Payments are separate transaction records:
 * they never edit or remove an earning, and the outstanding balance is always
 * earnings minus payments.
 */
const technicianPaymentSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technician',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paidAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'cash',
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    recordedByName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
  },
  { timestamps: true },
);

technicianPaymentSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('PAY');
  next();
});

technicianPaymentSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    reference: this.reference,
    technician: this.technician?.toString?.() ?? null,
    amount: this.amount,
    paidAt: this.paidAt?.toISOString?.() ?? null,
    method: this.method,
    methodLabel: PAYMENT_METHOD_LABELS[this.method] ?? this.method,
    referenceNumber: this.referenceNumber ?? '',
    remarks: this.remarks ?? '',
    recordedByName: this.recordedByName ?? '',
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('TechnicianPayment', technicianPaymentSchema);
