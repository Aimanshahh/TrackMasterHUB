import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { getStatus, getVehicles, postRefresh } from './vehicles.controller.js';

export const vehiclesRouter = Router();

vehiclesRouter.use(requireAuth);

// Vehicle records and live status are for the manager desk and the admin.
const vehicleDesk = requireRole('admin', 'manager');

vehiclesRouter.get('/', vehicleDesk, getVehicles);
vehiclesRouter.get('/sync-status', vehicleDesk, getStatus);
vehiclesRouter.post('/refresh', vehicleDesk, postRefresh);
