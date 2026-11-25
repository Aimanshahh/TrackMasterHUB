import mongoose from 'mongoose';

export const MICROPHONE_STATUSES = ['available', 'assigned', 'retired'];

/**
 * One-way microphone numbers, kept as real inventory. A number can only be
 * assigned to one customer/vehicle at a time; the history is append-only so an
 * earlier assignment is never erased when the number is moved.
 */
const microphoneNumberSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    status: {
      type: String,
      enum: MICROPHONE_STATUSES,
      default: 'available',
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    assignedAt: {
      type: Date,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedByName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    history: {
      type: [new mongoose.Schema({
        action: { type: String, enum: ['assigned', 'unassigned', 'retired', 'restored'], required: true },
        customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
        customerName: { type: String, trim: true, maxlength: 200, default: '' },
        job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
        at: { type: Date, default: Date.now },
        byName: { type: String, trim: true, maxlength: 120, default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' },
      }, { _id: false })],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

microphoneNumberSchema.methods.toApiJson = function () {
  const populated = (value) => Boolean(value && typeof value === 'object' && value._id);
  return {
    id: this._id.toString(),
    number: this.number,
    label: this.label ?? '',
    status: this.status,
    customer: populated(this.customer)
      ? { id: this.customer._id.toString(), name: this.customer.name, phone: this.customer.phone ?? '' }
      : this.customer?.toString() ?? null,
    job: populated(this.job)
      ? { id: this.job._id.toString(), reference: this.job.reference }
      : this.job?.toString() ?? null,
    assignedAt: this.assignedAt?.toISOString?.() ?? null,
    assignedByName: this.assignedByName ?? '',
    notes: this.notes ?? '',
    history: (this.history ?? []).map((entry) => ({
      action: entry.action,
      customerName: entry.customerName ?? '',
      at: entry.at?.toISOString?.() ?? null,
      by: entry.byName ?? '',
      note: entry.note ?? '',
    })),
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('MicrophoneNumber', microphoneNumberSchema);
