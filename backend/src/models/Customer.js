import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    // Optional: the plan's minimum record for a follow-up is a name and phone.
    // Email stays available for installation and account customers.
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 240,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    source: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    followUp: {
      type: mongoose.Schema.Types.Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

customerSchema.pre('save', function () {
  this.updatedAt = new Date();
});

customerSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email ?? '',
    phone: this.phone,
    company: this.company,
    category: this.category,
    priority: this.priority,
    source: this.source,
    followUp: this.followUp?.toISOString(),
    notes: this.notes,
    // A populated owner is intentionally reduced to the fields the UI needs.
    // Calling the full user serializer here fails when the query only selected
    // a few fields, so build the shape explicitly.
    owner: this.owner && this.owner.name
      ? {
        id: this.owner._id.toString(),
        name: this.owner.name,
        email: this.owner.email ?? '',
        role: this.owner.role ?? '',
      }
      : this.owner?._id
        ? { id: this.owner._id.toString() }
        : null,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export default mongoose.model('Customer', customerSchema);
