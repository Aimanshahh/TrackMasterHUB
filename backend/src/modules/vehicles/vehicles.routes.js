import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  getPendingInspectionExport,
  getProfile,
  getStatus,
  getVehicles,
  patchInspection,
  postRefresh,
} from './vehicles.controller.js';

export const vehiclesRouter = Router();

vehiclesRouter.use(requireAuth);

// Vehicle records and live status are for the manager desk and the admin.
const vehicleDesk = requireRole('admin', 'manager');
// Operations installs and maintains these vehicles, so it can read the list and each profile.
const vehicleReaders = requireRole('admin', 'manager', 'operations');

vehiclesRouter.get('/', vehicleReaders, getVehicles);
vehiclesRouter.get('/export/pending-inspections.csv', vehicleReaders, getPendingInspectionExport);
vehiclesRouter.get('/:id/profile', vehicleReaders, getProfile);
vehiclesRouter.patch('/:id/inspection', requireRole('admin', 'manager', 'operations'), patchInspection);
vehiclesRouter.get('/sync-status', vehicleDesk, getStatus);
vehiclesRouter.post('/refresh', vehicleDesk, postRefresh);
