import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';

await mongoose.connect(process.env.MONGO_URI);
const admin = await User.findOne({ role: 'admin' });
const token = crypto.randomBytes(48).toString('hex');
await Session.create({ token, user: admin._id, expiresAt: new Date(Date.now() + 86_400_000) });
console.log('TOKEN=' + token);
await mongoose.disconnect();
