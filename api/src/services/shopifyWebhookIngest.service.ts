import { db } from '../config/database';
import { applyShopifyProductsToPosProducts, type ShopifyProduct } from '../integrations/shopifyAdapter';

export async function isTenantCatalogSyncEnabled(tenantId: string): Promise<boolean> {
  const row = await db('tenants')
    .select('shopify_catalog_sync_enabled')
    .where({ id: tenantId })
    .first();
  return !!row?.shopify_catalog_sync_enabled;
}

/**
 * @returns true if this delivery should be processed; false if duplicate webhook id.
 */
export async function tryInsertShopifyWebhookReceipt(
  webhookId: string | undefined,
  tenantId: string,
  topic: string
): Promise<boolean> {
  if (!webhookId || !webhookId.trim()) return true;
  try {
    await db('shopify_webhook_receipts').insert({
      webhook_id: webhookId.trim().slice(0, 128),
      tenant_id: tenantId,
      topic: topic.slice(0, 128),
    });
    return true;
  } catch (err: any) {
    if (err?.code === '23505') return false;
    throw err;
  }
}

function parseProductPayload(payload: unknown): ShopifyProduct | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  if (o.product && typeof o.product === 'object') {
    const p = o.product as Record<string, unknown>;
    if (typeof p.id === 'number') return o.product as ShopifyProduct;
  }
  if (typeof o.id === 'number') {
    return o as unknown as ShopifyProduct;
  }
  return null;
}

export async function ingestProductsUpdateWebhook(tenantId: string, payload: unknown): Promise<boolean> {
  const product = parseProductPayload(payload);
  if (!product?.id) return false;
  await applyShopifyProductsToPosProducts(tenantId, [product]);
  return true;
}

/** Same payload shape as update; Shopify sends full product on create. */
export async function ingestProductsCreateWebhook(tenantId: string, payload: unknown): Promise<boolean> {
  return ingestProductsUpdateWebhook(tenantId, payload);
}

function parseShopifyProductIdFromDeletePayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  if (typeof o.id === 'number' && Number.isFinite(o.id)) return o.id;
  if (typeof o.id === 'string' && /^\d+$/.test(o.id)) return parseInt(o.id, 10);
  if (o.product && typeof o.product === 'object') {
    const p = (o.product as Record<string, unknown>).id;
    if (typeof p === 'number' && Number.isFinite(p)) return p;
    if (typeof p === 'string' && /^\d+$/.test(p)) return parseInt(p, 10);
  }
  return null;
}

/**
 * Remove all variant rows for this Shopify product id. Collection membership cascades on pos_products FK.
 */
export async function ingestProductsDeleteWebhook(tenantId: string, payload: unknown): Promise<number> {
  const shopifyProductId = parseShopifyProductIdFromDeletePayload(payload);
  if (shopifyProductId == null) return 0;
  const posProductIdStr = String(shopifyProductId);
  const n = await db('pos_products')
    .where({ tenant_id: tenantId, pos_product_id: posProductIdStr })
    .delete();
  return typeof n === 'number' ? n : 0;
}

export async function ingestInventoryLevelsUpdateWebhook(tenantId: string, payload: unknown): Promise<number> {
  if (!payload || typeof payload !== 'object') return 0;
  const o = payload as Record<string, unknown>;
  const inventoryItemId = o.inventory_item_id;
  const available = o.available;
  if (typeof inventoryItemId !== 'number' && typeof inventoryItemId !== 'string') return 0;
  const qty = typeof available === 'number' ? available : 0;
  const idStr = String(inventoryItemId);
  const now = new Date();
  const n = await db('pos_products')
    .where({ tenant_id: tenantId, shopify_inventory_item_id: idStr })
    .update({
      inventory_quantity: qty,
      last_synced_at: now,
      updated_at: now,
    });
  return typeof n === 'number' ? n : 0;
}
