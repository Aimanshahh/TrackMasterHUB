import mongoose from 'mongoose';

export const CERTIFICATE_STATUSES = ['active', 'cancelled', 'superseded'];
export const certificateStatusLabels = { active: 'Active', cancelled: 'Cancelled', superseded: 'Replaced' };

/**
 * A vehicle tracker certificate. Everything printed on it is copied in at the
 * time of issue, so a certificate always reprints exactly as it was issued even
 * if the customer or vehicle record is edited later. Numbers are never reused.
 */
const certificateSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    status: { type: String, enum: CERTIFICATE_STATUSES, default: 'active' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },

    customerSnapshot: {
      name: String,
      phone: String,
      cnic: String,
      address: String,
    },
    vehicleSnapshot: {
      registration: String,
      makeModel: String,
      engineNo: String,
      chassisNo: String,
      colour: String,
      deviceImei: String,
      simNumber: String,
    },
    showCnic: { type: Boolean, default: true },

    installedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    reissueOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Certificate', default: null },
    reissueReason: { type: String, trim: true, maxlength: 400, default: '' },
    replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Certificate', default: null },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { timestamps: true },
);

certificateSchema.index({ job: 1, status: 1 });

certificateSchema.methods.toApiJson = function () {
  const id = (value) => (value?._id ?? value)?.toString() ?? null;
  return {
    id: this._id.toString(),
    number: this.number,
    status: this.status,
    statusLabel: certificateStatusLabels[this.status],
    customerId: id(this.customer),
    jobId: id(this.job),
    customer: { name: this.customerSnapshot?.name ?? '', phone: this.customerSnapshot?.phone ?? '', cnic: this.customerSnapshot?.cnic ?? '', address: this.customerSnapshot?.address ?? '' },
    vehicle: {
      registration: this.vehicleSnapshot?.registration ?? '',
      makeModel: this.vehicleSnapshot?.makeModel ?? '',
      engineNo: this.vehicleSnapshot?.engineNo ?? '',
      chassisNo: this.vehicleSnapshot?.chassisNo ?? '',
      colour: this.vehicleSnapshot?.colour ?? '',
      deviceImei: this.vehicleSnapshot?.deviceImei ?? '',
      simNumber: this.vehicleSnapshot?.simNumber ?? '',
    },
    showCnic: this.showCnic,
    installedAt: this.installedAt?.toISOString() ?? null,
    expiresAt: this.expiresAt?.toISOString() ?? null,
    issuedAt: this.issuedAt?.toISOString() ?? null,
    issuedBy: this.issuedBy?.name ? { id: this.issuedBy._id.toString(), name: this.issuedBy.name } : { id: id(this.issuedBy) },
    reissueOf: id(this.reissueOf),
    reissueReason: this.reissueReason || '',
    replacedBy: id(this.replacedBy),
    cancelledAt: this.cancelledAt?.toISOString() ?? null,
    cancelReason: this.cancelReason || '',
  };
};

export default mongoose.model('Certificate', certificateSchema);
