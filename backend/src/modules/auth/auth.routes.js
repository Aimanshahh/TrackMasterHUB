import express from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import { login, logout, getMe, setupStatus, bootstrap, listAllUsers } from './auth.controller.js';

const router = express.Router();
router.post('/login', login);
// Logout is intentionally open: a browser with an expired or already-removed
// session must still be able to clear its cookie, otherwise it keeps bouncing
// back into the previous account.
router.post('/logout', logout);
router.get('/me', getMe);
router.get('/setup-status', setupStatus);
router.post('/bootstrap', bootstrap);
router.get('/users', requireAuth, requireAdmin, listAllUsers);

export const authRouter = router;
