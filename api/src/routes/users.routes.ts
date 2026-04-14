import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { fcmTokenRateLimiter } from '../middleware/rateLimiter';
import * as usersController from '../controllers/users.controller';
import * as customerNotificationsController from '../controllers/customerNotifications.controller';

const router = Router();

router.use(authMiddleware);

router.get('/users/me/notifications', customerNotificationsController.listMyNotifications);
router.patch('/users/me/notifications/:id/read', customerNotificationsController.markNotificationRead);

router.get('/users/me', usersController.getMe);
router.get('/users/me/water-care-consent', usersController.getWaterCareConsent);
router.post('/users/me/water-care-consent', usersController.postWaterCareConsent);
router.put('/users/me', usersController.putMe);
router.put('/users/me/fcm-token', fcmTokenRateLimiter, usersController.putFcmToken);
router.delete('/users/me', usersController.deleteMe);

export default router;
