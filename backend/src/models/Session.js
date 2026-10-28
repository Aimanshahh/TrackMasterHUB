import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Remove expired sessions. Run as a scheduled job. */
async function pruneExpiredSessions() {
  try {
    await sessionSchema.deleteMany({ expiresAt: { $lt: new Date() } });
  } catch (error) {
    console.error('[trackmaster-hub-api] session cleanup failed', error);
  }
}

/** Clean up after any session lookup, so expired tokens are removed lazily. */
async function pruneOnLookup(session) {
  if (session) {
    await pruneExpiredSessions();
  }
}

const Session = mongoose.model('Session', sessionSchema);

Session.pruneExpiredSessions = pruneExpiredSessions;
Session.pruneOnLookup = pruneOnLookup;

export default Session;
