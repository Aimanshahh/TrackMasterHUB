import { listPackages, updatePackage } from './pricing.service.js';

async function getPackages(_req, res, next) {
  try {
    return res.json(await listPackages());
  } catch (error) { next(error); }
}

async function patchPackage(req, res, next) {
  try {
    const pkg = await updatePackage(req.params.key, req.body ?? {}, req.user);
    return res.json({ data: { package: pkg } });
  } catch (error) { next(error); }
}

export { getPackages, patchPackage };
