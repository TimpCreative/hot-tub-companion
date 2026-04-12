import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as subscriptionsController from '../controllers/subscriptions.controller';

const router = Router();

router.use(authMiddleware);

router.post('/subscriptions/checkout-handoff', subscriptionsController.postCheckoutHandoff);
router.get('/subscriptions', subscriptionsController.listMySubscriptions);
router.post('/subscriptions/billing-portal', subscriptionsController.postBillingPortal);

export default router;
