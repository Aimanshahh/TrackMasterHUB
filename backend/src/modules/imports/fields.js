/**
 * The columns an import file can fill. `synonyms` drive the automatic column
 * matching; the person can always correct a match by hand.
 */
export const IMPORT_FIELDS = [
  { key: 'legacyId', label: 'Legacy customer ID', group: 'Customer', required: false, synonyms: ['legacy id', 'legacy customer id', 'customer id', 'client id', 'old id', 'old customer id', 'account no', 'account number', 'customer code', 'client code', 'code', 'id'] },
  { key: 'name', label: 'Customer name', group: 'Customer', required: true, synonyms: ['name', 'customer name', 'client name', 'full name', 'customer', 'client', 'owner name', 'owner', 'primary user', 'primary customer'] },
  { key: 'phone', label: 'Phone', group: 'Customer', required: true, synonyms: ['phone', 'mobile', 'mobile no', 'mobile number', 'phone number', 'cell', 'cell no', 'contact', 'contact no', 'contact number', 'whatsapp', 'number', 'primary user contact no'] },
  { key: 'email', label: 'Email', group: 'Customer', required: false, synonyms: ['email', 'e-mail', 'email address', 'mail'] },
  { key: 'company', label: 'Company', group: 'Customer', required: false, synonyms: ['company', 'company name', 'organization', 'organisation', 'business'] },
  { key: 'category', label: 'Category', group: 'Customer', required: false, synonyms: ['category', 'customer category', 'customer type', 'client type'] },
  { key: 'address', label: 'Address', group: 'Customer', required: false, synonyms: ['address', 'customer address', 'client address', 'location'] },
  { key: 'cnic', label: 'CNIC', group: 'Customer', required: false, synonyms: ['cnic', 'cnic no', 'cnic number', 'nic', 'id card', 'national id'] },
  { key: 'notes', label: 'Notes', group: 'Customer', required: false, synonyms: ['notes', 'note', 'remarks', 'remark', 'comments', 'comment', 'final remarks'] },
  { key: 'registration', label: 'Registration no.', group: 'Vehicle', required: false, synonyms: ['registration', 'registration no', 'registration number', 'reg no', 'reg', 'plate', 'plate no', 'number plate', 'vehicle no', 'vehicle number', 'vehicle registration', 'vrn', 'old vrn'] },
  { key: 'makeModel', label: 'Make / model', group: 'Vehicle', required: false, synonyms: ['make model', 'make/model', 'make and model', 'make', 'model', 'vehicle', 'vehicle name', 'vehicle model', 'car'] },
  { key: 'engineNo', label: 'Engine no.', group: 'Vehicle', required: false, synonyms: ['engine', 'engine no', 'engine number', 'engine #'] },
  { key: 'chassisNo', label: 'Chassis no.', group: 'Vehicle', required: false, synonyms: ['chassis', 'chassis no', 'chassis number', 'chasis', 'chasis no', 'chasis #'] },
  { key: 'colour', label: 'Colour', group: 'Vehicle', required: false, synonyms: ['colour', 'color', 'vehicle colour', 'vehicle color'] },
  { key: 'deviceImei', label: 'Tracker IMEI', group: 'Vehicle', required: false, synonyms: ['imei', 'imei no', 'device imei', 'tracker imei', 'device id', 'device no', 'tracker id', 'device imei'] },
  { key: 'simNumber', label: 'SIM number', group: 'Vehicle', required: false, synonyms: ['sim', 'sim no', 'sim number', 'sim card'] },
  { key: 'installedAt', label: 'Installation date', group: 'Vehicle', required: false, synonyms: ['installation date', 'install date', 'date of installation', 'installed on', 'installed at', 'installed', 'activation date'] },
];

export const FIELD_KEYS = IMPORT_FIELDS.map((field) => field.key);
