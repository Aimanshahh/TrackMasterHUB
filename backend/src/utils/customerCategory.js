import mongoose from 'mongoose';

import { coreVrn } from './vrn.js';

const FLEET_FROM = 3;
/** Only these are decided by the vehicle count. Dealer, Corporate and Other were chosen by a person and stay. */
const AUTOMATIC = new Set(['', 'Individual', 'Fleet']);

const plateOf = (value) => coreVrn(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** What the count alone says: 3 or more vehicles is a Fleet, 1 or 2 is Individual, none says nothing. */
export function categoryForCount(count) {
  if (!count) return null;
  return count >= FLEET_FROM ? 'Fleet' : 'Individual';
}

/**
 * Count a customer's vehicles (one per registration, so a two-device vehicle
 * counts once) and set Fleet or Individual to match. Never throws: a category
 * problem must not stop a vehicle from being saved.
 */
export async function refreshCustomerCategory(customerId) {
  try {
    if (!customerId) return null;
    const Customer = mongoose.model('Customer');
    const Job = mongoose.model('Job');
    const customer = await Customer.findById(customerId).select('category');
    if (!customer || !AUTOMATIC.has(String(customer.category ?? '').trim())) return null;

    const jobs = await Job.find({ customer: customerId, requestType: 'new_installation', status: { $ne: 'cancelled' } })
      .select('vehicle.registration').lean();
    const plates = new Set(jobs.map((job) => plateOf(job.vehicle?.registration)).filter(Boolean));
    const next = categoryForCount(plates.size);
    if (!next || next === customer.category) return next;

    await Customer.updateOne({ _id: customerId }, { $set: { category: next } });
    return next;
  } catch (error) {
    console.warn(`[category] could not refresh the customer category: ${error.message}`);
    return null;
  }
}
