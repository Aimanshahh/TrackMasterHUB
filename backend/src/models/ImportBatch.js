import mongoose from 'mongoose';

export const IMPORT_STATUSES = ['uploaded', 'previewed', 'importing', 'completed', 'failed'];
export const importStatusLabels = {
  uploaded: 'Uploaded',
  previewed: 'Previewed',
  importing: 'Importing',
  completed: 'Completed',
  failed: 'Failed',
};

/**
 * One customer import: the uploaded rows, the column mapping the admin chose,
 * the preview, and the outcome of every row. Nothing in the customer database
 * changes until the batch is confirmed.
 */
const importBatchSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, maxlength: 200 },
    fileType: { type: String, enum: ['xlsx', 'csv'] },
    fileHash: { type: String, index: true },
    status: { type: String, enum: IMPORT_STATUSES, default: 'uploaded' },
    headers: { type: [String], default: [] },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] }, // [{ n, cells[] }]
    rowCount: { type: Number, default: 0 },
    mapping: { type: mongoose.Schema.Types.Mixed, default: {} },
    options: { type: mongoose.Schema.Types.Mixed, default: { onExisting: 'attach' } },
    previewHash: { type: String },
    results: { type: [mongoose.Schema.Types.Mixed], default: [] }, // one per row, see imports.service
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, trim: true, maxlength: 400, default: '' },
  },
  { timestamps: true },
);

importBatchSchema.methods.toApiJson = function ({ withHeaders = false } = {}) {
  return {
    id: this._id.toString(),
    fileName: this.fileName,
    fileType: this.fileType,
    status: this.status,
    statusLabel: importStatusLabels[this.status],
    rowCount: this.rowCount,
    summary: this.summary,
    createdBy: this.createdBy?.name ? { id: this.createdBy._id.toString(), name: this.createdBy.name } : { id: this.createdBy?.toString() ?? '' },
    createdAt: this.createdAt.toISOString(),
    completedAt: this.completedAt?.toISOString() ?? null,
    error: this.error || '',
    ...(withHeaders ? { headers: this.headers, mapping: this.mapping, options: this.options, previewHash: this.previewHash ?? null } : {}),
  };
};

export default mongoose.model('ImportBatch', importBatchSchema);
