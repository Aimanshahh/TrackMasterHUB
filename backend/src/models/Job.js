import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';

export const JOB_STATUSES = [
  'unassigned',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export const jobStatusLabels = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const historySchema = new mongoose.Schema(
  {
    status: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const jobSchema = new mongoose.Schema(
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
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    requestType: {
      type: String,
      enum: ['new_installation', 'follow_up'],
      default: 'new_installation',
    },
    vehicle: {
      label: { type: String, trim: true, maxlength: 120 },
      registration: { type: String, trim: true, maxlength: 60 },
      station: { type: String, trim: true, maxlength: 120 },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'unassigned',
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technician',
    },
    deviceImei: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    simNumber: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    scheduledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    history: {
      type: [historySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

jobSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('JOB');
  next();
});

jobSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    reference: this.reference,
    customer: this.customer?._id ? this.customer._id.toString() : this.customer?.toString(),
    customerName: this.customerName ?? '',
    phone: this.phone ?? '',
    requestType: this.requestType,
    vehicle: {
      label: this.vehicle?.label ?? '',
      registration: this.vehicle?.registration ?? '',
      station: this.vehicle?.station ?? '',
    },
    priority: this.priority,
    status: this.status,
    statusLabel: jobStatusLabels[this.status] ?? this.status,
    technician: this.technician?.name
      ? { id: this.technician._id.toString(), name: this.technician.name, station: this.technician.station ?? '' }
      : this.technician?.toString() ?? null,
    deviceImei: this.deviceImei ?? '',
    simNumber: this.simNumber ?? '',
    scheduledAt: this.scheduledAt?.toISOString() ?? null,
    completedAt: this.completedAt?.toISOString() ?? null,
    notes: this.notes ?? '',
    history: (this.history ?? []).map((entry) => ({
      status: entry.status,
      statusLabel: jobStatusLabels[entry.status] ?? entry.status,
      note: entry.note ?? '',
      at: entry.at?.toISOString(),
    })),
    createdBy: this.createdBy?.toString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Job', jobSchema);
