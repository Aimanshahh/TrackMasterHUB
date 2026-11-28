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
  postPairDevice,
  postUnpairDevice,
  patchDeviceConfigured,
  patchJob,
  patchEngineKill,
  patchSim,
  patchTechnician,
  postDevice,
  postJob,
  postSim,
  postTechnician,
} from './operations.controller.js';
import {
  getMicrophoneTasks,
  getMicrophones,
  getReviews,
  patchSchedule,
  patchTechnicianRates,
  postAssignMicrophone,
  postMicrophone,
  postReleaseMicrophone,
  postRefreshReview,
  postReview,
} from './review.controller.js';
import {
  getDeskCustomer,
  getDeskCustomers,
  getShezzPreview,
  postShezzSync,
  getMessageTemplates,
  postMessagePreview,
  postMessageTemplate,
  postWhatsAppSend,
  postBindPortalSim,
} from './desk.controller.js';

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
operationsRouter.patch('/jobs/:id', requireRole('admin', 'operations', 'manager'), patchJob);
// Engine kill status is updated on its own, even after the installation is complete.
operationsRouter.patch('/jobs/:id/engine-kill', deskOnly, patchEngineKill);

operationsRouter.get('/technicians', deskOnly, getTechnicians);
operationsRouter.post('/technicians', deskOnly, postTechnician);
operationsRouter.patch('/technicians/:id', deskOnly, patchTechnician);
// Installation rates are money, so only the admin may change them.
operationsRouter.patch('/technicians/:id/rates', requireRole('admin'), patchTechnicianRates);

// Installation testing review: operations inspects what the technician submitted.
operationsRouter.get('/reviews', deskOnly, getReviews);
operationsRouter.post('/jobs/:id/review', deskOnly, postReview);
operationsRouter.post('/jobs/:id/review/refresh', deskOnly, postRefreshReview);
operationsRouter.patch('/jobs/:id/schedule', deskOnly, patchSchedule);

// One-way microphone numbers (Standard and Premium packages).
operationsRouter.get('/microphones', deskOnly, getMicrophones);
operationsRouter.post('/microphones', deskOnly, postMicrophone);
operationsRouter.post('/microphones/:id/assign', deskOnly, postAssignMicrophone);
operationsRouter.post('/microphones/:id/release', deskOnly, postReleaseMicrophone);
operationsRouter.get('/microphone-tasks', deskOnly, getMicrophoneTasks);

operationsRouter.get('/devices', deskOnly, getDevices);
operationsRouter.post('/devices', deskOnly, postDevice);
operationsRouter.patch('/devices/:id', deskOnly, patchDevice);
operationsRouter.post('/devices/:id/pair', deskOnly, postPairDevice);
operationsRouter.post('/devices/:id/unpair', deskOnly, postUnpairDevice);
operationsRouter.patch('/devices/:id/configured', deskOnly, patchDeviceConfigured);

operationsRouter.get('/sims', deskOnly, getSims);
operationsRouter.post('/sims', deskOnly, postSim);
operationsRouter.patch('/sims/:id', deskOnly, patchSim);

// Search-first customer lookup and profile for the desk. No prices or security briefing.
operationsRouter.get('/shezz/preview', deskOnly, getShezzPreview);
operationsRouter.post('/shezz/sync', deskOnly, postShezzSync);
operationsRouter.post('/stock-portal/bind-sim', deskOnly, postBindPortalSim);
operationsRouter.get('/customers', deskOnly, getDeskCustomers);
operationsRouter.get('/customers/:id', deskOnly, getDeskCustomer);

// WhatsApp template sender (goes out through the WhatsApp gateway).
operationsRouter.get('/message-templates', deskOnly, getMessageTemplates);
operationsRouter.post('/message-templates', deskOnly, postMessageTemplate);
operationsRouter.post('/whatsapp/preview', deskOnly, postMessagePreview);
operationsRouter.post('/whatsapp/send', deskOnly, postWhatsAppSend);
