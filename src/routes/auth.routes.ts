import { Router } from 'express';
import { register, login, logout, me, checkUsername, updateMe } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);
router.get('/check-username', authMiddleware, checkUsername);
router.patch('/me', authMiddleware, updateMe);

export default router;
