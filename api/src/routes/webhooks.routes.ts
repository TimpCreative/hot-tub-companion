import { Router } from 'express';
import * as shopifyWebhookController from '../controllers/shopifyWebhook.controller';

const router = Router();

router.post('/shopify/orders', shopifyWebhookController.handleOrdersCreate);

export default router;
