import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  getDevices,
  getJobs,
  getSims,
  getStationStock,
  getSummary,
  getTechnicianStock,
  getTechnicians,
  patchDevice,
  patchJob,
  patchSim,
  patchTechnician,
  postDevice,
  postJob,
  postSim,
  postTechnician,
} from './operations.controller.js';

export const operationsRouter = Router();

operationsRouter.use(requireAuth);

const deskOnly = requireRole('admin', 'operations');

operationsRouter.get('/summary', deskOnly, getSummary);
operationsRouter.get('/stock-by-station', deskOnly, getStationStock);
operationsRouter.get('/stock-by-technician', deskOnly, getTechnicianStock);

operationsRouter.get('/jobs', deskOnly, getJobs);
// A salesperson can push a customer request into the queue; only the desk can
// list the queue or change an existing job.
operationsRouter.post('/jobs', requireRole('admin', 'operations', 'salesperson'), postJob);
operationsRouter.patch('/jobs/:id', deskOnly, patchJob);

operationsRouter.get('/technicians', deskOnly, getTechnicians);
operationsRouter.post('/technicians', deskOnly, postTechnician);
operationsRouter.patch('/technicians/:id', deskOnly, patchTechnician);

operationsRouter.get('/devices', deskOnly, getDevices);
operationsRouter.post('/devices', deskOnly, postDevice);
operationsRouter.patch('/devices/:id', deskOnly, patchDevice);

operationsRouter.get('/sims', deskOnly, getSims);
operationsRouter.post('/sims', deskOnly, postSim);
operationsRouter.patch('/sims/:id', deskOnly, patchSim);
