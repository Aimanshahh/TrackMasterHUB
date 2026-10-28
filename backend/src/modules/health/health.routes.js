import express from 'express';
import { getHealth } from './health.controller.js';

const router = express.Router();

export const healthRouter = router;

healthRouter.get('/', getHealth);
