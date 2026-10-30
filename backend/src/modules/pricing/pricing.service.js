import Activity from '../../models/Activity.js';
import Package, { PACKAGE_KEYS, packageCatalog } from '../../models/Package.js';
import { errorCodes } from '../../config/errorCodes.js';
import { makeError } from '../../middleware/errors.js';

/** All rates are quoted in the business's own currency. */
export const CURRENCY = 'PKR';

function unconfigured(key) {
  const catalog = packageCatalog[key];
  return {
    key,
    name: catalog.name,
    price: null,
    summary: catalog.summary,
    features: [],
    configured: false,
    updatedAt: null,
  };
}

/**
 * Every package is always listed, including ones the admin has not priced yet.
 * A null price is honest: the salesperson sees that quoting is not possible
 * until the admin sets a rate, instead of a zero that looks like a real price.
 */
async function listPackages() {
  const docs = await Package.find({ key: { $in: PACKAGE_KEYS } });
  const byKey = new Map(docs.map((doc) => [doc.key, doc]));

  return {
    data: PACKAGE_KEYS.map((key) => (byKey.has(key) ? byKey.get(key).toApiJson() : unconfigured(key))),
    meta: { currency: CURRENCY },
  };
}

/** The configured rate for one package, or a clear error when it has none. */
async function getPackagePricing(key) {
  if (!PACKAGE_KEYS.includes(key)) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Choose one of the service packages.');
  }

  const doc = await Package.findOne({ key });
  if (!doc || !Number.isFinite(doc.price)) {
    throw makeError(
      errorCodes.VALIDATION_ERROR,
      `The ${packageCatalog[key].name} package has no rate yet. Ask the admin to set package pricing before quoting it.`,
    );
  }

  return doc;
}

function normaliseFeatures(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, 80));
}

async function updatePackage(key, input, actor) {
  if (!PACKAGE_KEYS.includes(key)) {
    throw makeError(errorCodes.NOT_FOUND, 'No package matches that key.');
  }

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw makeError(errorCodes.VALIDATION_ERROR, 'Enter the package price as a number greater than zero.');
  }

  const doc = (await Package.findOne({ key })) ?? new Package({ key });
  const catalog = packageCatalog[key];

  doc.price = Math.round(price * 100) / 100;
  doc.name = typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : catalog.name;
  doc.summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 300) : doc.summary ?? catalog.summary;
  if (input.features !== undefined) doc.features = normaliseFeatures(input.features);
  doc.updatedBy = actor.id;

  await doc.save();

  await Activity.create({
    actor: actor.id,
    type: 'pricing.updated',
    label: `${doc.name} package priced at ${CURRENCY} ${doc.price.toLocaleString()}`,
    description: `${actor.name ?? 'An admin'} set the ${doc.name} package rate.`,
  });

  return doc.toApiJson();
}

export { listPackages, getPackagePricing, updatePackage };
