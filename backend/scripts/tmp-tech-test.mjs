import 'dotenv/config';
import mongoose from 'mongoose';
import Customer from '../src/models/Customer.js';
import Job from '../src/models/Job.js';
import Device from '../src/models/Device.js';
import Technician from '../src/models/Technician.js';
import Notification from '../src/models/Notification.js';

await mongoose.connect(process.env.MONGO_URI);

const result = {
  jobs: (await Job.deleteMany({ customerName: { $regex: '^QA ' } })).deletedCount,
  customers: (await Customer.deleteMany({ email: { $regex: '^qa\\.' } })).deletedCount,
  devices: (await Device.deleteMany({ imei: { $regex: '^9900' } })).deletedCount,
  technicians: (await Technician.deleteMany({ name: { $regex: '^QA ' } })).deletedCount,
  notifications: (await Notification.deleteMany({ title: { $regex: 'QA' } })).deletedCount,
};

console.log(JSON.stringify(result));
await mongoose.disconnect();
