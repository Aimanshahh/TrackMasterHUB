import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getActivityHandler } from './activity.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getActivityHandler);

export const activityRouter = router;
