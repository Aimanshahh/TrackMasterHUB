import mongoose from 'mongoose';
import { refreshCustomerCategory } from '../utils/customerCategory.js';
import { makeReference } from '../utils/reference.js';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';
import { confirmedItems } from '../utils/packageChecklist.js';
import { packageHasEngineKill } from '../utils/customerLogin.js';
import { CHECKLIST_KEYS, ENGINE_KILL_STATUSES, completionStatus, engineKillLabels } from '../utils/installation.js';

export const JOB_STATUSES = [
  'unassigned',
  'assigned',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

export const jobStatusLabels = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PHYSICAL_STATUSES = [
  'Verified Active',
  'Pending Inspection',
  'Removed',
  'Needs Redo',
  'Uninstalled',
];

const historySchema = new mongoose.Schema(
  {
    status: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 1000 },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Who did it, kept as text so the history still reads correctly if the account is later renamed.
    byName: { type: String, trim: true, maxlength: 120 },
    // What kind of entry this is. `data` carries the checklist or engine-kill change it recorded.
    kind: { type: String, enum: ['status', 'details', 'checklist', 'engine_kill'], default: 'status' },
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const checklistFlags = Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, { type: Boolean, default: false }]));

/**
 * What the technician found and fitted. The technician has no login: Operations
 * enters everything here from what the technician reports.
 */
const installationSchema = new mongoose.Schema(
  {
    deviceModel: { type: String, trim: true, maxlength: 120, default: '' },
    placement: { type: String, trim: true, maxlength: 160, default: '' },
    address: { type: String, trim: true, maxlength: 400, default: '' },
    batteryTemperatureC: { type: Number, default: null },
    testResult: { type: String, trim: true, maxlength: 1000, default: '' },
    technicianRemarks: { type: String, trim: true, maxlength: 1000, default: '' },
    operationsRemarks: { type: String, trim: true, maxlength: 1000, default: '' },
    checklist: { type: new mongoose.Schema(checklistFlags, { _id: false }), default: () => ({}) },
    checklistUpdatedAt: { type: Date },
    /** Engine immobilization is tracked on its own: it never decides whether the GPS installation is complete. */
    engineKill: {
      status: { type: String, enum: ENGINE_KILL_STATUSES, default: 'not_set' },
      reason: { type: String, trim: true, maxlength: 400, default: '' },
      updatedAt: { type: Date },
      updatedByName: { type: String, trim: true, maxlength: 120 },
    },
  },
  { _id: false },
);

const jobSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    requestType: {
      type: String,
      enum: ['new_installation', 'follow_up'],
      default: 'new_installation',
    },
    vehicle: {
      label: { type: String, trim: true, maxlength: 120 },
      registration: { type: String, trim: true, maxlength: 60 },
      station: { type: String, trim: true, maxlength: 120 },
      engineNo: { type: String, trim: true, maxlength: 60 },
      chassisNo: { type: String, trim: true, maxlength: 60 },
      colour: { type: String, trim: true, maxlength: 40 },
      physicalStatus: { type: String, enum: PHYSICAL_STATUSES },
      inspectionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
      lastInspectedAt: { type: Date },
      inspectedBy: { type: String, trim: true, maxlength: 120, default: '' },
    },
    installation: { type: installationSchema, default: () => ({}) },
    /**
     * The four installation tests the technician performs on site, plus the
     * operations review that decides whether the installation is accepted.
     * Every result carries its own timestamp and where the reading came from,
     * so a manual verification is never presented as portal telemetry.
     */
    testing: {
      battery: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        connected: { type: Boolean, default: null },
        seenConnected: { type: Boolean, default: false },
        seenDisconnected: { type: Boolean, default: false },
        disconnectWorking: { type: Boolean, default: null },
        temperatureC: { type: Number, default: null },
        source: { type: String, enum: ['', 'portal', 'manual'], default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' },
        verifiedAt: { type: Date },
        verifiedByName: { type: String, trim: true, maxlength: 120, default: '' },
      },
      ignition: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        ignitionOn: { type: Boolean, default: null },
        seenOn: { type: Boolean, default: false },
        seenOff: { type: Boolean, default: false },
        objectStatus: { type: String, trim: true, maxlength: 200, default: '' },
        source: { type: String, enum: ['', 'portal', 'manual'], default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' },
        verifiedAt: { type: Date },
        verifiedByName: { type: String, trim: true, maxlength: 120, default: '' },
      },
      location: {
        status: { type: String, enum: ['pending', 'verified', 'failed'], default: 'pending' },
        physicalLocation: { type: String, trim: true, maxlength: 400, default: '' },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        gpsReceived: { type: Boolean, default: null },
        source: { type: String, enum: ['', 'portal', 'manual'], default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' },
        verifiedAt: { type: Date },
        verifiedByName: { type: String, trim: true, maxlength: 120, default: '' },
      },
      /** The last time the technician read this device from the tracking portal. */
      portalCheck: {
        at: { type: Date },
        found: { type: Boolean, default: null },
        stale: { type: Boolean, default: false },
        lastSeenAt: { type: Date },
        message: { type: String, trim: true, maxlength: 300, default: '' },
      },
      /** Engine kill needs operations, so the technician can only request it. */
      engineKillTest: {
        status: { type: String, enum: ['not_requested', 'requested', 'verified', 'failed', 'not_supported'], default: 'not_requested' },
        requestedAt: { type: Date },
        requestedByName: { type: String, trim: true, maxlength: 120, default: '' },
        requestNote: { type: String, trim: true, maxlength: 500, default: '' },
        activated: { type: Boolean, default: null },
        restored: { type: Boolean, default: null },
        verifiedAt: { type: Date },
        verifiedByName: { type: String, trim: true, maxlength: 120, default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' },
      },
      submittedAt: { type: Date },
      submittedByName: { type: String, trim: true, maxlength: 120, default: '' },
      review: {
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'retest'], default: 'pending' },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String, trim: true, maxlength: 120, default: '' },
        at: { type: Date },
        note: { type: String, trim: true, maxlength: 1000, default: '' },
      },
    },
    /** Append-only history of technician assignment and schedule changes. */
    scheduleHistory: {
      type: [new mongoose.Schema({
        kind: { type: String, enum: ['schedule', 'technician', 'address'], required: true },
        from: { type: String, trim: true, maxlength: 300, default: '' },
        to: { type: String, trim: true, maxlength: 300, default: '' },
        reason: { type: String, trim: true, maxlength: 500, default: '' },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String, trim: true, maxlength: 120, default: '' },
      }, { _id: false })],
      default: [],
    },
    /** Who brought this sale in. Independent agents are paid a commission. */
    agent: {
      source: { type: String, enum: ['direct', 'agent'], default: 'direct' },
      name: { type: String, trim: true, maxlength: 120, default: '' },
      phone: { type: String, trim: true, maxlength: 40, default: '' },
      commission: { type: Number, min: 0, default: 0 },
      commissionPaid: { type: Boolean, default: false },
      commissionPaidAt: { type: Date },
      commissionRemarks: { type: String, trim: true, maxlength: 500, default: '' },
    },
    /**
     * Standard and Premium packages include the one-way microphone. Once the
     * installation is approved, operations must assign a number to the vehicle.
     */
    microphone: {
      required: { type: Boolean, default: false },
      number: { type: String, trim: true, maxlength: 40, default: '' },
      assignedAt: { type: Date },
      assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      assignedByName: { type: String, trim: true, maxlength: 120, default: '' },
      note: { type: String, trim: true, maxlength: 500, default: '' },
    },
    /** Append-only record of every engine-kill status change, newest last. */
    engineKillHistory: {
      type: [new mongoose.Schema({
        from: { type: String, enum: ENGINE_KILL_STATUSES },
        to: { type: String, enum: ENGINE_KILL_STATUSES, required: true },
        reason: { type: String, trim: true, maxlength: 400, default: '' },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String, trim: true, maxlength: 120 },
      }, { _id: false })],
      default: [],
    },
    /** Set for vehicles brought in by the bulk import; they never went through the install workflow. */
    legacy: {
      imported: { type: Boolean, default: false },
      legacyId: { type: String, trim: true, maxlength: 80 },
      batch: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch' },
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'unassigned',
    },
    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Technician',
    },
    deviceImei: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    portalSource: {
      type: String,
      enum: ['', 'Main Server (Active)', 'Main Server (AMC Expired)', 'L8 Server'],
      default: '',
    },
    amcExpiryDate: {
      type: Date,
      default: null,
    },
    simNumber: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    /** Mobile network of the SIM, from the legacy import. */
    network: { type: String, trim: true, maxlength: 40, default: '' },
    /**
     * Every tracker fitted to this vehicle. Premium packages carry two (a
     * locator and an immobilizer). `deviceImei` / `simNumber` above stay the
     * primary device so every existing screen keeps working.
     */
    devices: {
      type: [new mongoose.Schema({
        role: { type: String, enum: ['locator', 'immobilizer', 'tracker'], default: 'tracker' },
        imei: { type: String, trim: true, maxlength: 20, default: '' },
        simNumber: { type: String, trim: true, maxlength: 40, default: '' },
        network: { type: String, trim: true, maxlength: 40, default: '' },
      }, { _id: false })],
      default: [],
    },
    simMode: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    loginId: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    oldVrn: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    installationDate: {
      type: Date,
    },
    installationMonth: {
      type: Number,
      min: 1,
      max: 12,
    },
    recordYear: {
      type: Number,
      min: 1900,
      max: 2200,
    },
    /* The commercial side of the sale. The package rate is copied from the
       admin's pricing when the job is created, so a later price change cannot
       rewrite an existing sale. */
    packageKey: {
      type: String,
      enum: PACKAGE_KEYS,
      default: null,
    },
    listPrice: {
      type: Number,
      default: null,
    },
    quotedPrice: {
      type: Number,
      default: null,
    },
    /** The minimum price in force when this sale was quoted; kept as a snapshot. */
    minimumPrice: {
      type: Number,
      default: null,
    },
    packageFeatures: {
      type: [String],
      default: [],
    },
    /** What the salesperson confirmed with the customer before the sale could be sent. */
    packageChecklist: {
      confirmed: { type: [String], default: [] },
      confirmedAt: { type: Date },
      confirmedByName: { type: String, trim: true, maxlength: 120, default: '' },
    },
    deviceOwnership: {
      type: String,
      enum: ['company', 'customer'],
      default: 'company',
    },
    approvalStatus: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required',
    },
    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Approval',
    },
    // Why a sale was cancelled (customer changed their mind, technician delayed, ...).
    cancellation: {
      reason: { type: String, enum: ['customer_changed_mind', 'technician_delayed', 'price_too_high', 'bought_elsewhere', 'other'] },
      note: { type: String, trim: true, maxlength: 500 },
      cancelledAt: Date,
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      previousStatus: String,
    },
    scheduledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    history: {
      type: [historySchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

jobSchema.pre('validate', function (next) {
  if (!this.reference) this.reference = makeReference('JOB');
  next();
});

function installationJson(job) {
  const i = job.installation ?? {};
  const checklist = {};
  for (const key of CHECKLIST_KEYS) checklist[key] = Boolean(i.checklist?.[key]);
  return {
    deviceModel: i.deviceModel ?? '',
    placement: i.placement ?? '',
    address: i.address ?? '',
    batteryTemperatureC: i.batteryTemperatureC ?? null,
    testResult: i.testResult ?? '',
    technicianRemarks: i.technicianRemarks ?? '',
    operationsRemarks: i.operationsRemarks ?? '',
    checklist,
    checklistUpdatedAt: i.checklistUpdatedAt?.toISOString?.() ?? null,
  };
}

function testingJson(job) {
  const t = job.testing ?? {};
  const read = (value) => ({
    status: value?.status ?? 'pending',
    source: value?.source ?? '',
    note: value?.note ?? '',
    verifiedAt: value?.verifiedAt?.toISOString?.() ?? null,
    verifiedByName: value?.verifiedByName ?? '',
  });
  return {
    battery: {
      ...read(t.battery),
      connected: t.battery?.connected ?? null,
      seenConnected: Boolean(t.battery?.seenConnected),
      seenDisconnected: Boolean(t.battery?.seenDisconnected),
      disconnectWorking: t.battery?.disconnectWorking ?? null,
      temperatureC: t.battery?.temperatureC ?? null,
    },
    ignition: {
      ...read(t.ignition),
      ignitionOn: t.ignition?.ignitionOn ?? null,
      seenOn: Boolean(t.ignition?.seenOn),
      seenOff: Boolean(t.ignition?.seenOff),
      objectStatus: t.ignition?.objectStatus ?? '',
    },
    location: {
      ...read(t.location),
      physicalLocation: t.location?.physicalLocation ?? '',
      latitude: t.location?.latitude ?? null,
      longitude: t.location?.longitude ?? null,
      gpsReceived: t.location?.gpsReceived ?? null,
    },
    portalCheck: {
      at: t.portalCheck?.at?.toISOString?.() ?? null,
      found: t.portalCheck?.found ?? null,
      stale: Boolean(t.portalCheck?.stale),
      lastSeenAt: t.portalCheck?.lastSeenAt?.toISOString?.() ?? null,
      message: t.portalCheck?.message ?? '',
    },
    engineKillApplicable: packageHasEngineKill(job.packageKey),
    engineKillTest: {
      status: t.engineKillTest?.status ?? 'not_requested',
      requestedAt: t.engineKillTest?.requestedAt?.toISOString?.() ?? null,
      requestedByName: t.engineKillTest?.requestedByName ?? '',
      requestNote: t.engineKillTest?.requestNote ?? '',
      activated: t.engineKillTest?.activated ?? null,
      restored: t.engineKillTest?.restored ?? null,
      verifiedAt: t.engineKillTest?.verifiedAt?.toISOString?.() ?? null,
      verifiedByName: t.engineKillTest?.verifiedByName ?? '',
      note: t.engineKillTest?.note ?? '',
    },
    submittedAt: t.submittedAt?.toISOString?.() ?? null,
    submittedByName: t.submittedByName ?? '',
    review: {
      status: t.review?.status ?? 'pending',
      byName: t.review?.byName ?? '',
      at: t.review?.at?.toISOString?.() ?? null,
      note: t.review?.note ?? '',
    },
  };
}

function engineKillJson(job) {
  const e = job.installation?.engineKill ?? {};
  const status = e.status ?? 'not_set';
  return {
    status,
    label: engineKillLabels[status],
    reason: e.reason ?? '',
    updatedAt: e.updatedAt?.toISOString?.() ?? null,
    updatedBy: e.updatedByName ?? '',
  };
}

jobSchema.methods.toApiJson = function ({ includeFinancials = true } = {}) {
  return {
    id: this._id.toString(),
    reference: this.reference,
    customer: this.customer?._id ? this.customer._id.toString() : this.customer?.toString(),
    customerName: this.customerName ?? '',
    phone: this.phone ?? '',
    requestType: this.requestType,
    vehicle: {
      label: this.vehicle?.label ?? '',
      registration: this.vehicle?.registration ?? '',
      station: this.vehicle?.station ?? '',
      engineNo: this.vehicle?.engineNo ?? '',
      chassisNo: this.vehicle?.chassisNo ?? '',
      colour: this.vehicle?.colour ?? '',
    },
    legacy: this.legacy?.imported ? { imported: true, legacyId: this.legacy.legacyId ?? '' } : null,
    priority: this.priority,
    status: this.status,
    statusLabel: jobStatusLabels[this.status] ?? this.status,
    technician: this.technician?.name
      ? { id: this.technician._id.toString(), name: this.technician.name, station: this.technician.station ?? '' }
      : this.technician?.toString() ?? null,
    deviceImei: this.deviceImei ?? '',
    network: this.network ?? '',
    devices: (this.devices ?? []).map((d) => ({ role: d.role, imei: d.imei ?? '', simNumber: d.simNumber ?? '', network: d.network ?? '' })),
    portalSource: this.portalSource ?? '',
    amcExpiryDate: this.amcExpiryDate?.toISOString() ?? null,
    simNumber: this.simNumber ?? '',
    simMode: this.simMode ?? '',
    loginId: this.loginId ?? '',
    oldVrn: this.oldVrn ?? '',
    installationDate: this.installationDate?.toISOString() ?? null,
    installationMonth: this.installationMonth ?? null,
    recordYear: this.recordYear ?? null,
    packageKey: this.packageKey ?? null,
    packageName: this.packageKey ? packageCatalog[this.packageKey]?.name ?? this.packageKey : '',
    ...(includeFinancials ? {
      listPrice: this.listPrice ?? null,
      minimumPrice: this.minimumPrice ?? null,
      quotedPrice: this.quotedPrice ?? null,
    } : {}),
    approvalStatus: this.approvalStatus ?? 'not_required',
    packageFeatures: this.packageFeatures ?? [],
    packageChecklist: {
      items: confirmedItems(this.packageKey, this.packageChecklist?.confirmed).map((item) => item.label),
      confirmedAt: this.packageChecklist?.confirmedAt?.toISOString?.() ?? null,
      confirmedByName: this.packageChecklist?.confirmedByName ?? '',
    },
    deviceOwnership: this.deviceOwnership ?? 'company',
    approvalId: this.approval ? this.approval.toString() : null,
    scheduledAt: this.scheduledAt?.toISOString() ?? null,
    completedAt: this.completedAt?.toISOString() ?? null,
    notes: this.notes ?? '',
    history: (this.history ?? []).map((entry) => ({
      status: entry.status,
      statusLabel: jobStatusLabels[entry.status] ?? entry.status,
      note: entry.note ?? '',
      at: entry.at?.toISOString(),
      kind: entry.kind ?? 'status',
      by: entry.byName ?? '',
      data: entry.data ?? null,
    })),
    installation: installationJson(this),
    testing: testingJson(this),
    scheduleHistory: (this.scheduleHistory ?? []).map((entry) => ({
      kind: entry.kind,
      from: entry.from ?? '',
      to: entry.to ?? '',
      reason: entry.reason ?? '',
      at: entry.at?.toISOString?.() ?? null,
      by: entry.byName ?? '',
    })),
    agent: {
      source: this.agent?.source ?? 'direct',
      name: this.agent?.name ?? '',
      phone: this.agent?.phone ?? '',
      commission: this.agent?.commission ?? 0,
      commissionPaid: Boolean(this.agent?.commissionPaid),
      commissionPaidAt: this.agent?.commissionPaidAt?.toISOString?.() ?? null,
      commissionRemarks: this.agent?.commissionRemarks ?? '',
    },
    microphone: {
      required: Boolean(this.microphone?.required),
      number: this.microphone?.number ?? '',
      assignedAt: this.microphone?.assignedAt?.toISOString?.() ?? null,
      assignedByName: this.microphone?.assignedByName ?? '',
      note: this.microphone?.note ?? '',
    },
    engineKill: engineKillJson(this),
    engineKillHistory: (this.engineKillHistory ?? []).map((entry) => ({
      from: entry.from ?? 'not_set',
      to: entry.to,
      toLabel: engineKillLabels[entry.to],
      reason: entry.reason ?? '',
      at: entry.at?.toISOString(),
      by: entry.byName ?? '',
    })),
    completion: this.requestType === 'new_installation' && this.status !== 'completed' && this.status !== 'cancelled'
      ? completionStatus(this)
      : null,
    createdBy: this.createdBy?.toString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

/** A new vehicle can change its customer's category (3+ vehicles is a Fleet). */
jobSchema.pre('save', function () { this.$locals.wasNew = this.isNew; });
jobSchema.post('save', function (doc) {
  if (!doc.$locals?.wasNew || doc.requestType !== 'new_installation' || !doc.customer) return undefined;
  return refreshCustomerCategory(doc.customer);
});

export default mongoose.model('Job', jobSchema);
