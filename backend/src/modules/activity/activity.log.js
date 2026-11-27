import Activity from '../../models/Activity.js';

/**
 * Write one line to the admin's audit trail. Recording must never stop the
 * action it describes, so a failure here is swallowed.
 */
export async function recordActivity({ actor, type, label, description = '', recordId }) {
  try {
    await Activity.create({ actor: actor?.id ?? actor, type, label: String(label).slice(0, 160), description: String(description).slice(0, 1000), recordId });
  } catch {
    /* the audit line is best effort */
  }
}
