import mongoose from 'mongoose';

/**
 * The three service packages are a fixed part of the product, not records an
 * admin creates: the salesperson always chooses one of these keys. Only the
 * rate and the wording are configuration, and the admin owns both.
 */
export const PACKAGE_KEYS = ['basic', 'standard', 'premium'];

export const packageCatalog = {
  basic: {
    key: 'basic',
    name: 'Basic',
    summary: 'Core tracking for a single vehicle.',
  },
  standard: {
    key: 'standard',
    name: 'Standard',
    summary: 'Tracking with engine cut-off and alert history.',
  },
  premium: {
    key: 'premium',
    name: 'Premium',
    summary: 'Full fleet-grade tracking with priority support.',
  },
};

const packageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: PACKAGE_KEYS,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    /** What the customer receives. Kept short — this is a quote aid, not a brochure. */
    features: {
      type: [String],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

packageSchema.methods.toApiJson = function () {
  return {
    key: this.key,
    name: this.name || packageCatalog[this.key]?.name || this.key,
    price: this.price,
    summary: this.summary ?? '',
    features: (this.features ?? []).filter(Boolean),
    configured: true,
    updatedAt: this.updatedAt?.toISOString() ?? null,
  };
};

export default mongoose.model('Package', packageSchema);
