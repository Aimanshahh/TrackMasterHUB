import express from 'express';
import { parseSessionCookie } from '../../middleware/cookie.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { login, logout, getMe, setupStatus, bootstrap, listAllUsers } from './auth.controller.js';

const router = express.Router();

router.post('/login', parseSessionCookie, login);
router.post('/logout', parseSessionCookie, logout);
router.get('/me', parseSessionCookie, getMe);
router.get('/setup-status', setupStatus);
router.post('/bootstrap', bootstrap);

/** Admin-only endpoints. */
router.use(requireAdmin);
router.get('/users', listAllUsers);

export const authRouter = router;
