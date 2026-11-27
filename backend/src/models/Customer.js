import mongoose from 'mongoose';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';

export const CUSTOMER_CATEGORIES = ['Individual', 'Fleet', 'Corporate', 'Dealer', 'Other'];

/**
 * One key per phone number on the record: the last ten digits, so
 * "0300-1112233", "+92 300 1112233" and "03001112233" all match. A field can
 * hold several numbers ("0300 1112233 / 0315 4445566").
 */
export function phoneKeysOf(phone) {
  const keys = new Set();
  for (const part of String(phone ?? '').split(/[/,;|]/)) {
    const digits = part.replace(/\D/g, '');
    if (digits.length >= 10) keys.add(digits.slice(-10));
    else if (digits.length >= 7) keys.add(digits);
  }
  return [...keys];
}

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
    packageKey: {
      type: String,
      enum: PACKAGE_KEYS,
      default: null,
    },
    packagePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    packageFeatures: {
      type: [String],
      default: [],
    },
    deviceOwnership: {
      type: String,
      enum: ['company', 'customer'],
      default: 'company',
    },
    address: { type: String, trim: true, maxlength: 400, default: '' },
    /** The customer's login for the tracking app. Shown on the account screens and used by the "Login Details" WhatsApp template. */
    appLogin: { type: String, trim: true, maxlength: 160, default: '' },
    appPassword: { type: String, trim: true, maxlength: 160, default: '' },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    /**
     * A customer who has agreed to buy but has not been installed yet. This is
     * a flag on the existing customer record, never a second customer record.
     */
    hotLead: {
      active: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['ready_for_installation', 'vehicle_unavailable', 'rescheduled', 'follow_up_required', 'converted', 'lost'],
      },
      reason: { type: String, trim: true, maxlength: 400, default: '' },
      remarks: { type: String, trim: true, maxlength: 1000, default: '' },
      expectedDate: { type: Date },
      nextFollowUp: { type: Date },
      packageKey: { type: String, enum: PACKAGE_KEYS },
      updatedAt: { type: Date },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedByName: { type: String, trim: true, maxlength: 120, default: '' },
    },
    /**
     * Existing customers brought in by the bulk import. They are already active
     * customers, so they skip new-customer onboarding and the security briefing.
     * Columns the import did not recognise are kept in `extra`.
     */
    legacy: {
      imported: { type: Boolean, default: false },
      legacyId: { type: String, trim: true, maxlength: 80 },
      batch: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch' },
      importedAt: { type: Date },
      extra: { type: mongoose.Schema.Types.Mixed },
    },
    /**
     * Account state is separate from installation: a completed installation
     * does not activate a customer. The manager's security briefing gate does.
     */
    accountStatus: {
      type: String,
      enum: ['inactive', 'active'],
      default: 'inactive',
    },
    briefingCompleted: {
      type: Boolean,
      default: false,
    },
    /**
     * Security briefing captured by the manager. Sensitive by definition, so it
     * is never included in list responses, notifications or exports; only the
     * manager/admin detail view reads it.
     */
    briefing: {
      cnic: { type: String, trim: true, maxlength: 20 },
      dob: { type: Date },
      ePin: { type: String, trim: true, maxlength: 12 },
      tPin: { type: String, trim: true, maxlength: 40 },
      secondaryPhone: { type: String, trim: true, maxlength: 60 },
      secondaryRelation: { type: String, trim: true, maxlength: 80 },
      geofenceAddress: { type: String, trim: true, maxlength: 400 },
      completedAt: { type: Date },
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    phoneKeys: {
      type: [String],
      index: true,
      default: undefined,
      select: false,
    },
  },
  { timestamps: true },
);

customerSchema.pre('save', function () {
  this.updatedAt = new Date();
  if (this.isNew || this.isModified('phone')) this.phoneKeys = phoneKeysOf(this.phone);
});

customerSchema.methods.toApiJson = function ({ includeFinancials = true } = {}) {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email ?? '',
    phone: this.phone,
    company: this.company,
    category: CUSTOMER_CATEGORIES.includes(this.category) ? this.category : '',
    priority: this.priority,
    source: this.source,
    followUp: this.followUp?.toISOString(),
    notes: this.notes,
    packageKey: this.packageKey ?? null,
    packageName: this.packageKey ? packageCatalog[this.packageKey]?.name ?? this.packageKey : '',
    packagePrice: includeFinancials ? this.packagePrice ?? null : null,
    packageFeatures: this.packageFeatures ?? [],
    deviceOwnership: this.deviceOwnership ?? 'company',
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
    address: this.address ?? '',
    legacy: this.legacy?.imported ? { imported: true, legacyId: this.legacy.legacyId ?? '' } : null,
    accountStatus: this.accountStatus ?? 'inactive',
    briefingCompleted: Boolean(this.briefingCompleted),
    hotLead: this.hotLead?.active
      ? {
        active: true,
        status: this.hotLead.status ?? 'follow_up_required',
        reason: this.hotLead.reason ?? '',
        remarks: this.hotLead.remarks ?? '',
        expectedDate: this.hotLead.expectedDate?.toISOString?.() ?? null,
        nextFollowUp: this.hotLead.nextFollowUp?.toISOString?.() ?? null,
        packageKey: this.hotLead.packageKey ?? null,
        updatedAt: this.hotLead.updatedAt?.toISOString?.() ?? null,
        updatedByName: this.hotLead.updatedByName ?? '',
      }
      : null,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

/**
 * Detail shape used by the manager and admin customer screens. The briefing is
 * included because those are the only roles authorised to see it.
 */
customerSchema.methods.toDetailJson = function (options = {}) {
  const base = this.toApiJson(options);

  return {
    ...base,
    appLogin: this.appLogin ?? '',
    appPassword: this.appPassword ?? '',
    briefing: {
      cnic: this.briefing?.cnic ?? '',
      dob: this.briefing?.dob?.toISOString() ?? null,
      ePin: this.briefing?.ePin ?? '',
      tPin: this.briefing?.tPin ?? '',
      secondaryPhone: this.briefing?.secondaryPhone ?? '',
      secondaryRelation: this.briefing?.secondaryRelation ?? '',
      geofenceAddress: this.briefing?.geofenceAddress ?? '',
      completedAt: this.briefing?.completedAt?.toISOString() ?? null,
    },
  };
};

/**
 * The operations desk sees the customer's account details and app login, but
 * never the security briefing (CNIC, PINs) or any price.
 */
customerSchema.methods.toOperationsJson = function () {
  return {
    ...this.toApiJson({ includeFinancials: false }),
    appLogin: this.appLogin ?? '',
    appPassword: this.appPassword ?? '',
  };
};

export default mongoose.model('Customer', customerSchema);
