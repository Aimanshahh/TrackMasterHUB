import { env } from '../config/env.js';
import { packageCatalog } from '../models/Package.js';

/** Packages that include an engine kill (immobilizer). Basic and Personal do not. */
export const ENGINE_KILL_PACKAGES = ['standard', 'premium', 'customize'];

export const packageHasEngineKill = (packageKey) => ENGINE_KILL_PACKAGES.includes(packageKey);

export const packageLabel = (key) => packageCatalog[key]?.name ?? key ?? '';

/** "vrn 567" -> "VRN-567": the plate as the portal and customer app know it. */
export function vrnSlug(registration) {
  return String(registration ?? '')
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The customer-app login for a vehicle, e.g. VRN-567@trackmaster.pk. */
export function suggestCustomerLogin(registration) {
  const slug = vrnSlug(registration);
  return slug ? `${slug}@${env.customerAppLoginDomain}`.toLowerCase() : '';
}
