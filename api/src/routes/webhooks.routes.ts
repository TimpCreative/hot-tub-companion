import { Router } from 'express';
import * as shopifyWebhookController from '../controllers/shopifyWebhook.controller';
import * as shopifyCatalogWebhooksController from '../controllers/shopifyCatalogWebhooks.controller';
import * as stripeWebhookController from '../controllers/stripeWebhook.controller';

const router = Router();

router.post('/stripe', stripeWebhookController.handleStripeWebhook);

router.post('/shopify/orders', shopifyWebhookController.handleOrdersCreate);
router.post('/shopify/products/create', shopifyCatalogWebhooksController.handleShopifyProductsCreate);
router.post('/shopify/products/update', shopifyCatalogWebhooksController.handleShopifyProductsUpdate);
router.post('/shopify/products/delete', shopifyCatalogWebhooksController.handleShopifyProductsDelete);
router.post(
  '/shopify/inventory_levels/update',
  shopifyCatalogWebhooksController.handleShopifyInventoryLevelsUpdate
);

export default router;
