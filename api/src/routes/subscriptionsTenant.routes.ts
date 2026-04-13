import { Router } from 'express';
import * as subscriptionsController from '../controllers/subscriptions.controller';

/**
 * Tenant API key only (no Firebase). Used for shop PDP bundle discovery before sign-in.
 */
const router = Router();

router.get('/subscriptions/products/:productId/bundle', subscriptionsController.getSubscriptionBundleForProduct);
router.get('/subscriptions/products/:productId/offers', subscriptionsController.getSubscriptionOffersForProductHandler);

export default router;
