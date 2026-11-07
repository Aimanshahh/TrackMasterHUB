import express from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { createUserAccount, getUsersList, getMe, getSalespersonProfile, changeUserRole } from './users.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/me', getMe);
router.get('/', requireAdmin, getUsersList);
router.get('/:id/performance', requireAdmin, getSalespersonProfile);
router.post('/', requireAdmin, createUserAccount);
router.patch('/:id/role', requireAdmin, changeUserRole);

export const usersRouter = router;
