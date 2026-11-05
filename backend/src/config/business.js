/**
 * Company details printed on certificates. Defaults are the company's current
 * letterhead; override any of them in .env without touching code.
 */
const env = process.env;

export const certificateBusiness = {
  legalName: env.CERT_COMPANY_NAME ?? 'Track Master Pvt. Ltd.',
  tagline: env.CERT_TAGLINE ?? 'Track with advance technology',
  email: env.CERT_EMAIL ?? 'info@trackmaster.pk',
  phones: (env.CERT_PHONES ?? '+92 319 2803563,+92 319 2803562,021-33262033').split(',').map((v) => v.trim()).filter(Boolean),
  address: env.CERT_ADDRESS ?? 'A-10 Ground Floor Saima Tower, Sector 15A/5, near Peoples Chowrangi, Karachi',
  website: env.CERT_WEBSITE ?? 'trackmaster.pk',
  numberPrefix: env.CERTIFICATE_NUMBER_PREFIX ?? 'TM-',
  numberStart: Math.max(1, Number(env.CERTIFICATE_NUMBER_START ?? 1) || 1),
  validMonths: Math.max(1, Number(env.CERTIFICATE_VALID_MONTHS ?? 12) || 12),
};
