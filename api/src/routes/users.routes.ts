import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as usersController from '../controllers/users.controller';

const router = Router();

router.use(authMiddleware);

router.get('/users/me', usersController.getMe);
router.put('/users/me', usersController.putMe);
router.delete('/users/me', usersController.deleteMe);

export default router;
