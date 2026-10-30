import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { ROLES, roleLabels, MIN_PASSWORD_LENGTH } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 240,
      match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Please enter a valid email address.'],
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'salesperson',
    },
    active: {
      type: Boolean,
      default: true,
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


/** Hash the password before it is saved. */
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/** Compare a candidate password against the stored hash. */
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

/** Remove sensitive fields before the document leaves the API. */
userSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    roleLabel: roleLabels[this.role],
    active: this.active,
    // Projections may omit timestamps (for example a populated customer
    // owner), so never assume the fields are present.
    createdAt: this.createdAt?.toISOString() ?? null,
    updatedAt: this.updatedAt?.toISOString() ?? null,
  };
};

export default mongoose.model('User', userSchema);
