import { Router } from 'express';
import * as ordersController from '../controllers/orders.controller';
import { authMiddleware } from '../middleware/auth';
import { commerceOrdersReadRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.get('/orders', commerceOrdersReadRateLimiter, authMiddleware, ordersController.listMyOrders);
router.get(
  '/orders/by-shopify/:shopifyOrderId',
  commerceOrdersReadRateLimiter,
  authMiddleware,
  ordersController.getMyOrderByShopifyId
);

export default router;
