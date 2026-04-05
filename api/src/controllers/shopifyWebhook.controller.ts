import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';
import { verifyShopifyWebhookRequest } from '../utils/shopifyWebhookVerify';
import { tryInsertShopifyWebhookReceipt } from '../services/shopifyWebhookIngest.service';
import { upsertOrderReference } from '../services/orderReference.service';

export async function handleOrdersCreate(req: Request, res: Response): Promise<void> {
  const v = await verifyShopifyWebhookRequest(req, res);
  if (!v) return;

  if (!v.payload || typeof v.payload !== 'object') {
    error(res, 'BAD_REQUEST', 'Invalid JSON body', 400);
    return;
  }

  const webhookId = req.headers['x-shopify-webhook-id'] as string | undefined;
  const proceed = await tryInsertShopifyWebhookReceipt(webhookId, v.tenantId, 'orders/create');
  if (!proceed) {
    success(res, { received: true, duplicate: true });
    return;
  }

  const payload = v.payload as { id?: number; order_number?: number; email?: string };
  const rawId = payload.id;
  if (rawId === undefined || rawId === null) {
    success(res, { received: true, noop: true });
    return;
  }
  const shopifyOrderId = String(rawId);
  const orderNumber = typeof payload.order_number === 'number' ? payload.order_number : null;
  const email =
    payload.email && typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;

  let matchedUserId: string | null = null;
  if (email) {
    const user = await db('users')
      .select('id')
      .where({ tenant_id: v.tenantId, email })
      .whereNull('deleted_at')
      .first();
    matchedUserId = user?.id ?? null;
  }

  try {
    await upsertOrderReference({
      tenantId: v.tenantId,
      shopifyOrderId,
      shopifyOrderNumber: orderNumber,
      userId: matchedUserId,
      customerEmail: email,
    });
  } catch (err) {
    console.warn('[shopifyWebhook] order_references upsert failed:', err);
  }

  if (matchedUserId) {
    const orderNum = orderNumber ?? shopifyOrderId;
    const title = 'Order confirmed';
    const body = `Your order #${orderNum} has been placed.`;
    void notificationService
      .sendToUser(matchedUserId, v.tenantId, title, body, undefined, 'orders', {
        type: 'order',
        createdByType: 'system',
        createdById: 'shopify_webhook',
      })
      .catch((err) => console.warn('[shopifyWebhook] order notification failed:', err));
  }

  success(res, { received: true });
}
