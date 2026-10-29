import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['complaint.status_changed', 'installation.status_changed', 'stock.low'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    meta: {
      reference: { type: String, trim: true, maxlength: 60 },
      recordId: { type: String, trim: true, maxlength: 60 },
      status: { type: String, trim: true, maxlength: 60 },
      station: { type: String, trim: true, maxlength: 120 },
    },
    readAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1, 'meta.station': 1, createdAt: -1 });

notificationSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    type: this.type,
    title: this.title,
    body: this.body ?? '',
    link: this.link ?? '',
    meta: {
      reference: this.meta?.reference ?? '',
      recordId: this.meta?.recordId ?? '',
      status: this.meta?.status ?? '',
      station: this.meta?.station ?? '',
    },
    read: Boolean(this.readAt),
    createdAt: this.createdAt.toISOString(),
  };
};

export default mongoose.model('Notification', notificationSchema);
