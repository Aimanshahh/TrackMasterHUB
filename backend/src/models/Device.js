import mongoose from 'mongoose';

export const DEVICE_STATUSES = ['in_stock', 'assigned', 'out_of_service'];

const deviceSchema = new mongoose.Schema(
  {
    imei: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^\d{14,17}$/, 'IMEI must contain 14 to 17 digits.'],
    },
    model: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: DEVICE_STATUSES,
      default: 'in_stock',
    },
    station: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technician',
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

deviceSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    imei: this.imei,
    model: this.model ?? '',
    status: this.status,
    station: this.station ?? '',
    technician: this.technician,
    job: this.job?.toString(),
    notes: this.notes ?? '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Device', deviceSchema);
