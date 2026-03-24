import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';

function normalizeShopDomain(domain: string): string {
  const s = domain.trim().toLowerCase();
  if (s.startsWith('https://')) return s.slice(8).replace(/\/.*$/, '');
  if (s.startsWith('http://')) return s.slice(7).replace(/\/.*$/, '');
  return s.split('/')[0];
}

export async function handleOrdersCreate(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    error(res, 'BAD_REQUEST', 'Raw body required for webhook verification', 400);
    return;
  }

  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string | undefined;
  if (!hmacHeader) {
    error(res, 'UNAUTHORIZED', 'Missing X-Shopify-Hmac-Sha256', 401);
    return;
  }

  const shopDomain = req.headers['x-shopify-shop-domain'] as string | undefined;
  if (!shopDomain) {
    error(res, 'BAD_REQUEST', 'Missing X-Shopify-Shop-Domain', 400);
    return;
  }

  const normalizedDomain = normalizeShopDomain(shopDomain);
  const tenants = await db('tenants')
    .select('id', 'shopify_store_url', 'shopify_webhook_secret')
    .whereNotNull('shopify_store_url')
    .whereNotNull('shopify_webhook_secret');

  let tenant: { id: string; shopify_webhook_secret: string } | null = null;
  for (const t of tenants) {
    const tenantUrl = (t as { shopify_store_url?: string }).shopify_store_url as string;
    if (tenantUrl && normalizeShopDomain(tenantUrl) === normalizedDomain) {
      tenant = t as { id: string; shopify_webhook_secret: string };
      break;
    }
  }

  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found for this shop', 404);
    return;
  }

  const secret = tenant.shopify_webhook_secret;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  try {
    const hashBuf = Buffer.from(hash, 'base64');
    const expectedBuf = Buffer.from(hmacHeader, 'base64');
    if (hashBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hashBuf, expectedBuf)) {
      error(res, 'UNAUTHORIZED', 'Invalid webhook signature', 401);
      return;
    }
  } catch {
    error(res, 'UNAUTHORIZED', 'Invalid webhook signature', 401);
    return;
  }

  let payload: { id?: number; order_number?: number; email?: string } = {};
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as typeof payload;
  } catch {
    error(res, 'BAD_REQUEST', 'Invalid JSON body', 400);
    return;
  }

  const email = payload.email && typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null;
  if (!email) {
    success(res, { received: true });
    return;
  }

  const user = await db('users')
    .select('id')
    .where({ tenant_id: tenant.id, email })
    .whereNull('deleted_at')
    .first();

  if (user) {
    const orderNum = payload.order_number ?? payload.id ?? '?';
    const title = 'Order confirmed';
    const body = `Your order #${orderNum} has been placed! 🛒`;
    void notificationService
      .sendToUser(user.id, tenant.id, title, body, undefined, 'orders', {
        type: 'order',
        createdByType: 'system',
        createdById: 'shopify_webhook',
      })
      .catch((err) => console.warn('[shopifyWebhook] order notification failed:', err));
  }

  success(res, { received: true });
}
