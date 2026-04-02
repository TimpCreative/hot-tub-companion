import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';
import { verifyShopifyWebhookRequest } from '../utils/shopifyWebhookVerify';

export async function handleOrdersCreate(req: Request, res: Response): Promise<void> {
  const v = await verifyShopifyWebhookRequest(req, res);
  if (!v) return;

  if (!v.payload || typeof v.payload !== 'object') {
    error(res, 'BAD_REQUEST', 'Invalid JSON body', 400);
    return;
  }

  const payload = v.payload as { id?: number; order_number?: number; email?: string };
  const email =
    payload.email && typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  if (!email) {
    success(res, { received: true });
    return;
  }

  const user = await db('users')
    .select('id')
    .where({ tenant_id: v.tenantId, email })
    .whereNull('deleted_at')
    .first();

  if (user) {
    const orderNum = payload.order_number ?? payload.id ?? '?';
    const title = 'Order confirmed';
    const body = `Your order #${orderNum} has been placed! 🛒`;
    void notificationService
      .sendToUser(user.id, v.tenantId, title, body, undefined, 'orders', {
        type: 'order',
        createdByType: 'system',
        createdById: 'shopify_webhook',
      })
      .catch((err) => console.warn('[shopifyWebhook] order notification failed:', err));
  }

  success(res, { received: true });
}
