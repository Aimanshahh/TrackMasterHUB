import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'customer.created',
        'customer.updated',
        'customer.archived',
        'user.created',
        'user.role_changed',
        'user.deactivated',
        'pricing.updated',
        'approval.decided',
      ],
    },
    label: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

activitySchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    actor: this.actor?.toString(),
    type: this.type,
    label: this.label,
    description: this.description,
    recordId: this.recordId?.toString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Activity', activitySchema);
