import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';

export const COMPLAINT_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'waiting_customer',
  'resolved',
  'closed',
];

export const complaintStatusLabels = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  waiting_customer: 'Waiting for customer',
  resolved: 'Resolved',
  closed: 'Closed',
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

const complaintSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'General',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'open',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resolution: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    history: {
      type: [historySchema],
      default: [],
    },
  },
  { timestamps: true },
);

complaintSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('CMP');
  next();
});

complaintSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    reference: this.reference,
    customer: this.customer?.toString() ?? null,
    customerName: this.customerName ?? '',
    phone: this.phone ?? '',
    title: this.title,
    description: this.description ?? '',
    category: this.category,
    priority: this.priority,
    status: this.status,
    statusLabel: complaintStatusLabels[this.status] ?? this.status,
    assignedTo: this.assignedTo?.name
      ? { id: this.assignedTo._id.toString(), name: this.assignedTo.name }
      : this.assignedTo?.toString() ?? null,
    createdBy: this.createdBy?.name
      ? { id: this.createdBy._id.toString(), name: this.createdBy.name }
      : this.createdBy?.toString() ?? null,
    resolution: this.resolution ?? '',
    history: (this.history ?? []).map((entry) => ({
      status: entry.status,
      statusLabel: complaintStatusLabels[entry.status] ?? entry.status,
      note: entry.note ?? '',
      at: entry.at?.toISOString(),
    })),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Complaint', complaintSchema);
