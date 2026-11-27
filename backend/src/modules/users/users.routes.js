import express from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { createUserAccount, getUsersList, getMe, getSalespersonProfile, changeUserRole, setSalespersonTarget, resetPassword } from './users.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/me', getMe);
router.get('/', requireAdmin, getUsersList);
router.get('/:id/performance', requireAdmin, getSalespersonProfile);
router.post('/', requireAdmin, createUserAccount);
router.patch('/:id/role', requireAdmin, changeUserRole);
router.patch('/:id/password', requireAdmin, resetPassword);
router.patch('/:id/target', requireAdmin, setSalespersonTarget);

export const usersRouter = router;
