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
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Technician', technicianSchema);
