import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);
router.post('/verify', authRateLimiter, authController.verify);

export default router;
