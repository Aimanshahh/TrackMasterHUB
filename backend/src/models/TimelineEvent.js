import mongoose from 'mongoose';

export const TIMELINE_KINDS = ['package', 'inspection', 'amc', 'note'];

/**
 * A line of history that came from the legacy sheet. The sheet has no dates for
 * past actions, so `date` is null and `isHistoricalData` is true; the customer
 * screen lists these at the bottom as "Legacy Record: … (Date Unknown)".
 * Events with a real date are still built from the live records, not stored here.
 */
const timelineEventSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    vrn: { type: String, trim: true, maxlength: 60, default: '' },
    kind: { type: String, enum: TIMELINE_KINDS, required: true },
    action: { type: String, trim: true, maxlength: 200, required: true },
    detail: { type: String, trim: true, maxlength: 400, default: '' },
    date: { type: Date, default: null },
    isHistoricalData: { type: Boolean, default: false },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch' },
  },
  { timestamps: true },
);

timelineEventSchema.methods.toApiJson = function () {
  const unknown = this.isHistoricalData && !this.date;
  const label = { package: 'Package', inspection: 'Inspection', amc: 'AMC', note: 'Note' }[this.kind] ?? 'Record';
  return {
    id: this._id.toString(),
    kind: this.kind,
    isHistoricalData: Boolean(this.isHistoricalData),
    at: this.date ? this.date.toISOString() : null,
    vrn: this.vrn ?? '',
    title: unknown ? `Legacy Record: ${label}: ${this.action} (Date Unknown)` : `${label}: ${this.action}`,
    detail: this.detail ?? '',
    source: 'Legacy import',
  };
};

export default mongoose.model('TimelineEvent', timelineEventSchema);
