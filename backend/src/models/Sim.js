import mongoose from 'mongoose';

export const SIM_STATUSES = ['in_stock', 'assigned', 'installed', 'returned', 'faulty', 'out_of_service'];

export const SIM_STATUS_LABELS = {
  in_stock: 'Available',
  assigned: 'Reserved',
  installed: 'Installed',
  returned: 'Returned',
  faulty: 'Faulty',
  out_of_service: 'Out of service',
};

const simSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    iccid: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    operator: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    status: {
      type: String,
      enum: SIM_STATUSES,
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
    /** IMEI of the device this SIM is fitted with. */
    deviceImei: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    assignedAt: {
      type: Date,
    },
    installedAt: {
      type: Date,
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

simSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    number: this.number,
    iccid: this.iccid ?? '',
    operator: this.operator ?? '',
    status: this.status,
    statusLabel: SIM_STATUS_LABELS[this.status] ?? this.status,
    station: this.station ?? '',
    technician: this.technician,
    job: this.job?.toString(),
    deviceImei: this.deviceImei ?? '',
    assignedAt: this.assignedAt?.toISOString?.() ?? null,
    installedAt: this.installedAt?.toISOString?.() ?? null,
    notes: this.notes ?? '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Sim', simSchema);
