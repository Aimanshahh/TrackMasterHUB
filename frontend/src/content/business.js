
/**
 * Business details printed on invoices.
 *
 * IMPORTANT:
 * Replace the temporary NTN with the actual NTN
 * before issuing invoices to customers.
 */

export const BUSINESS = {
  name: 'TrackMaster',
  legalName: 'Track Master Pvt Ltd',
  address: 'North Nazimabad, Karachi, Sector 15-A/5',
  phone: '0339 0221291',
  email: 'info@trackmaster.pk',
  taxNumber: '788776',
  website: 'trackmaster.com.pk',

  warrantyNote:
    'TrackMaster devices carry a 6-month warranty from the date of installation.',

  paymentNote:
    'Please quote the invoice number with every payment.',
};

/**
 * True while any business detail is still temporary.
 */
export const BUSINESS_DETAILS_INCOMPLETE = Object.values(BUSINESS).some(
  (value) =>
    typeof value === 'string' &&
    (value.startsWith('TODO') || value.startsWith('TEMP-')),
);
