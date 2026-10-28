import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getUsersList, getMe, changeUserRole } from './users.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getUsersList);
router.get('/me', getMe);
router.patch('/:id/role', changeUserRole);

export const usersRouter = router;
