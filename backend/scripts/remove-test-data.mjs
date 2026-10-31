/**
 * Removes only the records created by seed-test-pipeline.mjs.
 *
 * It matches the test staff accounts by their @trackmaster.test email domain,
 * and the test customers by the marker line in their notes, so a real customer
 * can never be deleted by this script. Package rates are intentionally left in
 * place — they are real business configuration, not test data.
 *
 *   cd backend && node scripts/remove-test-data.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import Activity from '../src/models/Activity.js';
import Approval from '../src/models/Approval.js';
import Complaint from '../src/models/Complaint.js';
import Customer from '../src/models/Customer.js';
import Device from '../src/models/Device.js';
import Invoice from '../src/models/Invoice.js';
import Job from '../src/models/Job.js';
import Notification from '../src/models/Notification.js';
import Payment from '../src/models/Payment.js';
import Session from '../src/models/Session.js';
import Sim from '../src/models/Sim.js';
import Technician from '../src/models/Technician.js';
import User from '../src/models/User.js';
import { env } from '../src/config/env.js';

const MARKER = 'TEST DATA — pipeline walkthrough';

await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });

const testUsers = await User.find({ email: /@trackmaster\.test$/ }).select('_id');
const testUserIds = testUsers.map((row) => row._id);

const testCustomers = await Customer.find({ notes: new RegExp(MARKER) }).select('_id');
const testCustomerIds = testCustomers.map((row) => row._id);

const testJobs = await Job.find({ customer: { $in: testCustomerIds } }).select('_id');
const testJobIds = testJobs.map((row) => row._id);

const testInvoices = await Invoice.find({ customer: { $in: testCustomerIds } }).select('_id');
const testInvoiceIds = testInvoices.map((row) => row._id);

const removed = {};
removed.payments = (await Payment.deleteMany({ invoice: { $in: testInvoiceIds } })).deletedCount;
removed.invoices = (await Invoice.deleteMany({ _id: { $in: testInvoiceIds } })).deletedCount;
removed.approvals = (await Approval.deleteMany({ job: { $in: testJobIds } })).deletedCount;
removed.complaints = (await Complaint.deleteMany({ customer: { $in: testCustomerIds } })).deletedCount;
removed.jobs = (await Job.deleteMany({ _id: { $in: testJobIds } })).deletedCount;
removed.customers = (await Customer.deleteMany({ _id: { $in: testCustomerIds } })).deletedCount;
removed.technicians = (await Technician.deleteMany({ name: 'Usman Khalid' })).deletedCount;
removed.devices = (await Device.deleteMany({ imei: '861234567890123' })).deletedCount;
removed.sims = (await Sim.deleteMany({ number: '0345-1122334' })).deletedCount;
removed.notifications = (await Notification.deleteMany({
  $or: [
    { user: { $in: testUserIds } },
    { body: /Ahmed Raza|Bilal Traders/ },
    { title: /Ahmed Raza|Bilal Traders/ },
  ],
})).deletedCount;
removed.sessions = (await Session.deleteMany({ user: { $in: testUserIds } })).deletedCount;
removed.users = (await User.deleteMany({ _id: { $in: testUserIds } })).deletedCount;
removed.activities = (await Activity.deleteMany({
  $or: [{ label: /Ahmed Raza|Bilal Traders/ }, { description: /Ahmed Raza|Bilal Traders/ }],
})).deletedCount;

console.log(removed);
console.log('Package rates were left in place; edit them in Admin → Pricing.');

await mongoose.disconnect();
