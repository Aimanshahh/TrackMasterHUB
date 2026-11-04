import mongoose from 'mongoose';

export const CALL_STATUSES = ['answered', 'no_answer', 'busy', 'other'];
export const callStatusLabels = { answered: 'Answered', no_answer: 'No answer', busy: 'Busy', other: 'Other' };

/** One robocall result received from the provider. The raw payload is kept exactly as sent. */
const callSchema = new mongoose.Schema(
  {
    callId: { type: String, required: true, unique: true, trim: true },
    calledNumber: { type: String, trim: true, default: '' },
    phoneKey: { type: String, trim: true, default: '', index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    status: { type: String, enum: CALL_STATUSES, default: 'other' },
    providerStatus: { type: String, trim: true, default: '' },
    durationSeconds: { type: Number, default: 0 },
    dtmf: { type: String, trim: true, default: '' },
    alertId: { type: String, trim: true, default: '' },
    alertType: { type: String, trim: true, default: '' },
    amount: { type: Number, default: null },
    currency: { type: String, default: 'PKR' },
    calledAt: { type: Date, required: true, index: true },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

callSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    callId: this.callId,
    calledNumber: this.calledNumber,
    customer: this.customer && this.customer.name
      ? { id: this.customer._id.toString(), name: this.customer.name }
      : null,
    customerId: this.customer?._id ? this.customer._id.toString() : this.customer?.toString() ?? null,
    status: this.status,
    statusLabel: callStatusLabels[this.status],
    providerStatus: this.providerStatus,
    durationSeconds: this.durationSeconds,
    dtmf: this.dtmf,
    alertId: this.alertId,
    alertType: this.alertType,
    amount: this.amount,
    currency: this.currency,
    calledAt: this.calledAt.toISOString(),
  };
};

export default mongoose.model('CallLog', callSchema);
