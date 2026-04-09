import { Router } from 'express';
import * as ordersController from '../controllers/orders.controller';
import { authMiddleware } from '../middleware/auth';
import { commerceOrdersReadRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/orders', commerceOrdersReadRateLimiter, authMiddleware, ordersController.listMyOrders);
router.post(
  '/orders/sync',
  commerceOrdersReadRateLimiter,
  authMiddleware,
  ordersController.syncMyOrdersFromShopify
);
router.post(
  '/orders/claim',
  commerceOrdersReadRateLimiter,
  authMiddleware,
  ordersController.claimMyOrderByEmailAndConfirmation
);
router.get(
  '/orders/by-shopify/:shopifyOrderId',
  commerceOrdersReadRateLimiter,
  authMiddleware,
  ordersController.getMyOrderByShopifyId
);
router.get(
  '/orders/:referenceId',
  commerceOrdersReadRateLimiter,
  authMiddleware,
  ordersController.getMyOrderByReferenceId
);

export default router;
