/**
 * Business details printed on invoices.
 *
 * PLACEHOLDERS: replace every value marked "TODO" with the real details before
 * invoices are handed to customers. Nothing else in the app needs to change.
 */
export const BUSINESS = {
  name: 'TrackMaster',
  legalName: 'TODO: registered business name',
  address: 'TODO: shop / office address',
  phone: 'TODO: phone number',
  email: 'TODO: email address',
  taxNumber: 'TODO: NTN / registration number',
  website: 'trackmaster.com.pk',
  // Shown at the foot of every invoice. Confirm the exact wording.
  warrantyNote: 'TrackMaster devices carry a 6-month warranty from the date of installation.',
  paymentNote: 'Please quote the invoice number with every payment.',
};

/** True while any printed detail is still a placeholder. */
export const BUSINESS_DETAILS_INCOMPLETE = Object.values(BUSINESS).some(
  (value) => typeof value === 'string' && value.startsWith('TODO'),
);
