import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

await mongoose.connect(process.env.MONGO_URI);

let user = await User.findOne({ email: 'qa.ops.browser@trackmaster.test' });
if (user) {
  user.passwordHash = 'QaBrowserPass123';
  await user.save();
} else {
  user = await User.create({ name: 'QA Operations', email: 'qa.ops.browser@trackmaster.test', passwordHash: 'QaBrowserPass123', role: 'operations' });
}

console.log('ready');
await mongoose.disconnect();
