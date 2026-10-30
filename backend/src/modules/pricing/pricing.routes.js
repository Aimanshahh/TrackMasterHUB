import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { getPackages, patchPackage } from './pricing.controller.js';

export const pricingRouter = Router();

pricingRouter.use(requireAuth);

// Salespeople need the rates to quote an installation; only the admin edits them.
pricingRouter.get('/', getPackages);
pricingRouter.patch('/:key', requireAdmin, patchPackage);
