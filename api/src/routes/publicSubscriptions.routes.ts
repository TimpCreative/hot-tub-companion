import { Router } from 'express';
import * as publicSubscriptionsController from '../controllers/publicSubscriptions.controller';

const router = Router();

router.post('/start-checkout', publicSubscriptionsController.postStartSubscriptionCheckout);

export default router;
