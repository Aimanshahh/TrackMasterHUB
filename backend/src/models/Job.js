import mongoose from 'mongoose';
import { makeReference } from '../utils/reference.js';
import { PACKAGE_KEYS, packageCatalog } from './Package.js';
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
    },
    installation: { type: installationSchema, default: () => ({}) },
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
    simNumber: {
      type: String,
      trim: true,
      maxlength: 40,
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
    approvalStatus: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required',
    },
    approval: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Approval',
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

jobSchema.methods.toApiJson = function () {
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
    simNumber: this.simNumber ?? '',
    simMode: this.simMode ?? '',
    loginId: this.loginId ?? '',
    oldVrn: this.oldVrn ?? '',
    installationDate: this.installationDate?.toISOString() ?? null,
    installationMonth: this.installationMonth ?? null,
    recordYear: this.recordYear ?? null,
    packageKey: this.packageKey ?? null,
    packageName: this.packageKey ? packageCatalog[this.packageKey]?.name ?? this.packageKey : '',
    listPrice: this.listPrice ?? null,
    quotedPrice: this.quotedPrice ?? null,
    approvalStatus: this.approvalStatus ?? 'not_required',
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

export default mongoose.model('Job', jobSchema);
