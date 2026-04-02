import { Request, Response } from 'express';
import { success } from '../utils/response';
import { verifyShopifyWebhookRequest } from '../utils/shopifyWebhookVerify';
import {
  ingestInventoryLevelsUpdateWebhook,
  ingestProductsUpdateWebhook,
  isTenantCatalogSyncEnabled,
  tryInsertShopifyWebhookReceipt,
} from '../services/shopifyWebhookIngest.service';
import { logPosIntegrationActivity } from '../services/posIntegrationActivity.service';

export async function handleShopifyProductsUpdate(req: Request, res: Response): Promise<void> {
  const v = await verifyShopifyWebhookRequest(req, res);
  if (!v) return;

  if (!(await isTenantCatalogSyncEnabled(v.tenantId))) {
    success(res, { received: true, skipped: true });
    return;
  }

  const webhookId = req.headers['x-shopify-webhook-id'] as string | undefined;
  const proceed = await tryInsertShopifyWebhookReceipt(webhookId, v.tenantId, 'products/update');
  if (!proceed) {
    success(res, { received: true, duplicate: true });
    return;
  }

  try {
    const applied = await ingestProductsUpdateWebhook(v.tenantId, v.payload);
    if (!applied) {
      success(res, { received: true, noop: true });
      return;
    }
    const pid =
      v.payload && typeof v.payload === 'object' && 'id' in v.payload
        ? (v.payload as { id?: number }).id
        : null;
    await logPosIntegrationActivity(v.tenantId, {
      eventType: 'webhook_products_update',
      summary:
        typeof pid === 'number'
          ? `Shopify product ${pid} applied to catalog`
          : 'Shopify product update applied to catalog',
      source: 'webhook',
      metadata: { shopifyProductId: pid, webhookId: webhookId ?? null },
    });
  } catch (err: any) {
    console.warn('[shopifyCatalogWebhooks] products/update ingest failed:', err?.message || err);
  }

  success(res, { received: true });
}

export async function handleShopifyInventoryLevelsUpdate(req: Request, res: Response): Promise<void> {
  const v = await verifyShopifyWebhookRequest(req, res);
  if (!v) return;

  if (!(await isTenantCatalogSyncEnabled(v.tenantId))) {
    success(res, { received: true, skipped: true });
    return;
  }

  const webhookId = req.headers['x-shopify-webhook-id'] as string | undefined;
  const proceed = await tryInsertShopifyWebhookReceipt(webhookId, v.tenantId, 'inventory_levels/update');
  if (!proceed) {
    success(res, { received: true, duplicate: true });
    return;
  }

  try {
    const rows = await ingestInventoryLevelsUpdateWebhook(v.tenantId, v.payload);
    let inventoryItemId: string | number | null = null;
    if (v.payload && typeof v.payload === 'object' && 'inventory_item_id' in v.payload) {
      const raw = (v.payload as { inventory_item_id?: unknown }).inventory_item_id;
      if (typeof raw === 'number' || typeof raw === 'string') inventoryItemId = raw;
    }
    if (rows === 0) {
      success(res, { received: true, noop: true });
      return;
    }
    await logPosIntegrationActivity(v.tenantId, {
      eventType: 'webhook_inventory_levels_update',
      summary:
        inventoryItemId != null
          ? `Inventory updated for item ${inventoryItemId} (${rows} variant row(s))`
          : 'Inventory level update applied',
      source: 'webhook',
      metadata: { inventoryItemId, rowsUpdated: rows, webhookId: webhookId ?? null },
    });
  } catch (err: any) {
    console.warn('[shopifyCatalogWebhooks] inventory_levels/update ingest failed:', err?.message || err);
  }

  success(res, { received: true });
}
