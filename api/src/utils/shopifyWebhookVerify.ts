import type { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/database';
import { error } from './response';
import { decryptTenantSecret } from './tenantSecrets';
import { normalizeShopDomain } from '../services/tenantPosConfig.service';

export type VerifiedShopifyWebhook = {
  tenantId: string;
  /** Parsed JSON when body is valid UTF-8 JSON; otherwise null. */
  payload: unknown;
  rawBody: Buffer;
};

/**
 * Verify HMAC and resolve tenant by X-Shopify-Shop-Domain. Sends HTTP error response on failure.
 */
export async function verifyShopifyWebhookRequest(
  req: Request,
  res: Response
): Promise<VerifiedShopifyWebhook | null> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    error(res, 'BAD_REQUEST', 'Raw body required for webhook verification', 400);
    return null;
  }

  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string | undefined;
  if (!hmacHeader) {
    error(res, 'UNAUTHORIZED', 'Missing X-Shopify-Hmac-Sha256', 401);
    return null;
  }

  const shopDomain = req.headers['x-shopify-shop-domain'] as string | undefined;
  if (!shopDomain) {
    error(res, 'BAD_REQUEST', 'Missing X-Shopify-Shop-Domain', 400);
    return null;
  }

  const normalizedDomain = normalizeShopDomain(shopDomain);
  const tenant = (await db('tenants')
    .select('id', 'shopify_store_url', 'shopify_webhook_secret')
    .whereRaw('LOWER(shopify_store_url) = ?', [normalizedDomain])
    .whereNotNull('shopify_webhook_secret')
    .first()) as { id: string; shopify_webhook_secret: string } | undefined;

  if (!tenant) {
    console.warn(
      '[shopifyWebhookVerify] No tenant for webhook shop domain (POS "Shopify store URL" must be the same *.myshopify.com host Shopify sends, not a custom storefront domain):',
      normalizedDomain
    );
    error(res, 'NOT_FOUND', 'Tenant not found for this shop', 404);
    return null;
  }

  const secret = decryptTenantSecret(tenant.shopify_webhook_secret);
  if (!secret) {
    error(res, 'CONFIG_ERROR', 'Webhook secret is not configured for this tenant', 500);
    return null;
  }
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  try {
    const hashBuf = Buffer.from(hash, 'base64');
    const expectedBuf = Buffer.from(hmacHeader, 'base64');
    if (hashBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hashBuf, expectedBuf)) {
      error(res, 'UNAUTHORIZED', 'Invalid webhook signature', 401);
      return null;
    }
  } catch {
    error(res, 'UNAUTHORIZED', 'Invalid webhook signature', 401);
    return null;
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    payload = null;
  }

  return { tenantId: tenant.id, payload, rawBody };
}
