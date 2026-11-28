import mongoose from 'mongoose';

/**
 * Stock states. `in_stock` is the station store, `assigned` means issued to a
 * technician or reserved for one installation, `installed` is fitted to a
 * vehicle, and the rest are the end states an admin or operations records.
 */
export const DEVICE_STATUSES = ['in_stock', 'assigned', 'installed', 'returned', 'faulty', 'out_of_service'];

export const DEVICE_STATUS_LABELS = {
  in_stock: 'Available',
  assigned: 'Reserved',
  installed: 'Installed',
  returned: 'Returned',
  faulty: 'Faulty',
  out_of_service: 'Out of service',
};

/** States that still belong to the technician's working stock. */
export const USABLE_DEVICE_STATUSES = ['in_stock', 'assigned'];

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
    /** The SIM fitted with this device, recorded when the technician installs it. */
    simNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    /** Operations has checked that this device and its SIM are set up and working together. */
    configured: { type: Boolean, default: false },
    configuredAt: { type: Date },
    configuredByName: { type: String, trim: true, maxlength: 120, default: '' },
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

deviceSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    imei: this.imei,
    model: this.model ?? '',
    status: this.status,
    statusLabel: DEVICE_STATUS_LABELS[this.status] ?? this.status,
    station: this.station ?? '',
    technician: this.technician,
    job: this.job?.toString(),
    simNumber: this.simNumber ?? '',
    configured: Boolean(this.configured),
    configuredAt: this.configuredAt?.toISOString?.() ?? null,
    configuredByName: this.configuredByName ?? '',
    assignedAt: this.assignedAt?.toISOString?.() ?? null,
    installedAt: this.installedAt?.toISOString?.() ?? null,
    notes: this.notes ?? '',
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Device', deviceSchema);
