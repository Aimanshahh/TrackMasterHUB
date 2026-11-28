import mongoose from 'mongoose';

/**
 * One device taken off one vehicle by one technician. Kept apart from
 * installations. There is at most one removal per installation job, which is
 * what stops the same device being added back to stock twice.
 */
const deviceRemovalSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, unique: true },
    registration: { type: String, trim: true, maxlength: 40 },
    vehicleLabel: { type: String, trim: true, maxlength: 120 },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40 },
    imei: { type: String, required: true, trim: true, index: true },
    simNumber: { type: String, trim: true, maxlength: 40, default: '' },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician', required: true, index: true },
    technicianName: { type: String, trim: true, maxlength: 120 },
    removedAt: { type: Date, default: Date.now, index: true },
    status: { type: String, enum: ['confirmed'], default: 'confirmed' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

deviceRemovalSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    jobId: this.job?.toString(),
    registration: this.registration ?? '',
    vehicleLabel: this.vehicleLabel ?? '',
    customerName: this.customerName ?? '',
    phone: this.phone ?? '',
    imei: this.imei,
    simNumber: this.simNumber ?? '',
    technician: this.technician?.toString?.() ?? null,
    technicianName: this.technicianName ?? '',
    removedAt: this.removedAt?.toISOString() ?? null,
    status: this.status,
    statusLabel: 'Removed, back in stock',
    note: this.note ?? '',
  };
};

export default mongoose.model('DeviceRemoval', deviceRemovalSchema);
