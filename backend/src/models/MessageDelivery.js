import mongoose from 'mongoose';

export const MESSAGE_STATUSES = ['pending', 'retrying', 'sent', 'failed', 'not_configured', 'skipped', 'manual'];

export const messageStatusLabels = {
  pending: 'Queued',
  retrying: 'Retrying',
  sent: 'Sent',
  failed: 'Failed',
  not_configured: 'Not configured',
  skipped: 'Not sent',
  manual: 'Handled manually',
};

const channelLabels = { email: 'Email', whatsapp: 'WhatsApp' };

/**
 * One row per message the system tried (or decided not) to send about a
 * complaint. The unique key stops the same status change emailing twice.
 */
const messageSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true },
    complaintReference: { type: String, trim: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    template: { type: String, required: true },
    historyIndex: { type: Number, required: true },
    to: { type: String, trim: true, default: '' },
    subject: { type: String, trim: true, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'pending' },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, trim: true, maxlength: 400, default: '' },
    nextAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    manualNote: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { timestamps: true },
);

messageSchema.index({ complaint: 1, channel: 1, historyIndex: 1 }, { unique: true });
messageSchema.index({ status: 1, nextAttemptAt: 1 });

messageSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    complaintId: this.complaint.toString(),
    complaintReference: this.complaintReference ?? '',
    channel: this.channel,
    channelLabel: channelLabels[this.channel],
    template: this.template,
    to: this.to,
    subject: this.subject,
    status: this.status,
    statusLabel: messageStatusLabels[this.status],
    attempts: this.attempts,
    error: this.lastError || '',
    manualNote: this.manualNote || '',
    sentAt: this.sentAt?.toISOString() ?? null,
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('MessageDelivery', messageSchema);
