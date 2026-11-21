import mongoose from 'mongoose';

/**
 * A reusable WhatsApp message with [Placeholders]. Which placeholders exist is
 * decided in utils/messageTemplates.js, so a template can never ask for a value
 * the system cannot fill in.
 */
const messageTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    active: { type: Boolean, default: true },
    /** The templates the system ships with. */
    builtIn: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

messageTemplateSchema.methods.toApiJson = function () {
  return {
    id: this._id.toString(),
    key: this.key,
    name: this.name,
    body: this.body,
    builtIn: Boolean(this.builtIn),
    createdAt: this.createdAt?.toISOString() ?? null,
  };
};

export default mongoose.model('MessageTemplate', messageTemplateSchema);
