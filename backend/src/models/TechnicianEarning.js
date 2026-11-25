import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';

export const EARNING_TYPES = ['normal', 'redo'];

/**
 * Created by the backend when an installation is approved. The technician's
 * rate at that moment is copied onto the record, so changing a rate later never
 * rewrites money that was already earned.
 */
const technicianEarningSchema = new mongoose.Schema(
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
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    vehicleRegistration: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    type: {
      type: String,
      enum: EARNING_TYPES,
      default: 'normal',
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    additional: {
      type: Number,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedByName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
    /** Reversals keep the record and add an adjustment instead of deleting it. */
    reversed: {
      type: Boolean,
      default: false,
    },
    reversedAt: { type: Date },
    reversalNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

technicianEarningSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('ERN');
  next();
});

technicianEarningSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    reference: this.reference,
    technician: this.technician?.toString?.() ?? null,
    job: this.job?.toString?.() ?? null,
    customerName: this.customerName ?? '',
    vehicleRegistration: this.vehicleRegistration ?? '',
    type: this.type,
    typeLabel: this.type === 'redo' ? 'Redo installation' : 'Normal installation',
    rate: this.rate,
    additional: this.additional ?? 0,
    amount: this.amount,
    note: this.note ?? '',
    approvedByName: this.approvedByName ?? '',
    earnedAt: this.earnedAt?.toISOString?.() ?? null,
    reversed: Boolean(this.reversed),
    reversalNote: this.reversalNote ?? '',
  };
};

export default mongoose.model('TechnicianEarning', technicianEarningSchema);
