import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getDashboardData } from './dashboard.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getDashboardData);

export const dashboardRouter = router;
