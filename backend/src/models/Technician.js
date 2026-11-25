import mongoose from 'mongoose';

const technicianSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    station: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    // Other spellings of this technician's name (for example on Shezz Traders), remembered once confirmed.
    aliases: {
      type: [String],
      default: [],
    },
    /** The login account this technician signs in with. Created and linked by the admin. */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    /**
     * What the business pays this technician per approved installation. The rate
     * is copied onto each earning record, so a later change here never rewrites
     * work that has already been paid or billed.
     */
    rates: {
      normal: { type: Number, min: 0, default: null },
      redo: { type: Number, min: 0, default: null },
      additional: { type: Number, min: 0, default: 0 },
      effectiveFrom: { type: Date },
      remarks: { type: String, trim: true, maxlength: 400, default: '' },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    active: {
      type: Boolean,
      default: true,
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

technicianSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    phone: this.phone ?? '',
    station: this.station ?? '',
    active: this.active,
    notes: this.notes ?? '',
    user: this.user?.toString?.() ?? null,
    rates: {
      normal: this.rates?.normal ?? null,
      redo: this.rates?.redo ?? null,
      additional: this.rates?.additional ?? 0,
      effectiveFrom: this.rates?.effectiveFrom?.toISOString?.() ?? null,
      remarks: this.rates?.remarks ?? '',
      updatedAt: this.rates?.updatedAt?.toISOString?.() ?? null,
    },
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Technician', technicianSchema);
