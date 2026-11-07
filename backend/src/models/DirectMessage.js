import mongoose from 'mongoose';

const directMessageSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    channel: { type: String, enum: ['whatsapp'], default: 'whatsapp' },
    to: { type: String, trim: true, required: true },
    body: { type: String, trim: true, maxlength: 4096, required: true },
    status: { type: String, enum: ['not_configured', 'pending', 'sent', 'failed'], default: 'not_configured' },
    lastError: { type: String, trim: true, maxlength: 400, default: '' },
    sentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

directMessageSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    customerId: this.customer.toString(),
    channel: this.channel,
    to: this.to,
    body: this.body,
    status: this.status,
    error: this.lastError || '',
    sentAt: this.sentAt?.toISOString() ?? null,
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('DirectMessage', directMessageSchema);
