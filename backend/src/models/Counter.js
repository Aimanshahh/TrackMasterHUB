import mongoose from 'mongoose';

/** Named sequences (certificate numbers). Incremented atomically, so two people issuing at once never share a number. */
const counterSchema = new mongoose.Schema({ _id: { type: String }, seq: { type: Number, default: 0 } }, { versionKey: false });
const Counter = mongoose.model('Counter', counterSchema);
export default Counter;

export async function nextSequence(key, start = 1) {
  const first = Math.max(1, Number(start) || 1);
  try {
    await Counter.updateOne({ _id: key }, { $setOnInsert: { seq: first - 1 } }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error; // another request created it first
  }
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true });
  return doc.seq;
}
