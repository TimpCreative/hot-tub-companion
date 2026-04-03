import { db } from '../config/database';
import { env } from '../config/environment';
import { shopifyAdminJson } from '../integrations/shopifyAdapter';
import { logPosIntegrationActivity } from './posIntegrationActivity.service';

const CATALOG_WEBHOOK_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'inventory_levels/update',
] as const;
const TOPIC_SET = new Set<string>(CATALOG_WEBHOOK_TOPICS);

function publicApiBase(): string {
  return env.PUBLIC_API_URL.replace(/\/+$/, '');
}

function webhookAddress(topic: string): string {
  return `${publicApiBase()}/api/v1/webhooks/shopify/${topic}`;
}

/**
 * Ensure Shopify REST webhooks exist for catalog + inventory topics.
 * Persists subscription ids on the tenant for clean removal on disable.
 */
export async function ensureShopifyCatalogWebhooks(tenantId: string): Promise<void> {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant || tenant.pos_type !== 'shopify') return;

  const base = publicApiBase();
  if (!base.startsWith('https://')) {
    console.warn('[shopifyWebhooks] PUBLIC_API_URL should be https for Shopify webhook delivery');
  }

  const listRes = await shopifyAdminJson(tenantId, 'GET', '/webhooks.json?limit=250');
  if (!listRes.ok) {
    const t = await listRes.text();
    throw new Error(`Shopify list webhooks failed (${listRes.status}): ${t}`);
  }
  const listBody = (await listRes.json()) as {
    webhooks?: Array<{ id: number; topic: string; address: string }>;
  };
  const existing = listBody.webhooks ?? [];
  const trackedIds: number[] = [];

  for (const topic of CATALOG_WEBHOOK_TOPICS) {
    const address = webhookAddress(topic);
    const found = existing.find((w) => w.topic === topic && w.address === address);
    if (found) {
      trackedIds.push(found.id);
      continue;
    }
    const createRes = await shopifyAdminJson(tenantId, 'POST', '/webhooks.json', {
      webhook: {
        topic,
        address,
        format: 'json',
      },
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`Shopify create webhook ${topic} failed (${createRes.status}): ${t}`);
    }
    const created = (await createRes.json()) as { webhook?: { id: number } };
    if (created.webhook?.id) trackedIds.push(created.webhook.id);
  }

  await db('tenants').where({ id: tenantId }).update({
    shopify_webhook_subscription_ids: JSON.stringify(trackedIds),
    updated_at: db.fn.now(),
  });

  await logPosIntegrationActivity(tenantId, {
    eventType: 'shopify_webhooks_registered',
    summary: 'Shopify catalog webhooks registered (products/update, inventory_levels/update)',
    source: 'system',
    metadata: { subscriptionIds: trackedIds },
  });
}

/**
 * Delete webhooks we registered and clear stored ids.
 */
export async function removeShopifyCatalogWebhooks(tenantId: string): Promise<void> {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) return;

  let ids: number[] = [];
  const raw = tenant.shopify_webhook_subscription_ids as string | number[] | null | undefined;
  if (raw) {
    try {
      ids = typeof raw === 'string' ? (JSON.parse(raw) as number[]) : raw;
    } catch {
      ids = [];
    }
  }
  if (!Array.isArray(ids)) ids = [];

  for (const id of ids) {
    const del = await shopifyAdminJson(tenantId, 'DELETE', `/webhooks/${id}.json`);
    if (!del.ok && del.status !== 404) {
      const t = await del.text();
      console.warn(`[shopifyWebhooks] DELETE /webhooks/${id}.json: ${del.status} ${t}`);
    }
  }

  const base = publicApiBase();
  const listRes = await shopifyAdminJson(tenantId, 'GET', '/webhooks.json?limit=250');
  if (listRes.ok) {
    const listBody = (await listRes.json()) as {
      webhooks?: Array<{ id: number; topic: string; address: string }>;
    };
    const prefix = `${base}/api/v1/webhooks/shopify/`;
    for (const w of listBody.webhooks ?? []) {
      if (TOPIC_SET.has(w.topic) && w.address.startsWith(prefix)) {
        await shopifyAdminJson(tenantId, 'DELETE', `/webhooks/${w.id}.json`);
      }
    }
  }

  await db('tenants').where({ id: tenantId }).update({
    shopify_webhook_subscription_ids: null,
    updated_at: db.fn.now(),
  });

  await logPosIntegrationActivity(tenantId, {
    eventType: 'shopify_webhooks_removed',
    summary: 'Shopify catalog webhooks removed',
    source: 'system',
  });
}

/**
 * After POS settings change: remove catalog webhooks when automation is turned off or POS is no longer Shopify;
 * register webhooks when automation is newly enabled for Shopify.
 */
export async function reconcileShopifyCatalogWebhooks(opts: {
  tenantId: string;
  wasShopify: boolean;
  wasCatalogSyncEnabled: boolean;
  isShopify: boolean;
  isCatalogSyncEnabled: boolean;
}): Promise<void> {
  const { tenantId, wasShopify, wasCatalogSyncEnabled, isShopify, isCatalogSyncEnabled } = opts;

  const hadHooks = wasShopify && wasCatalogSyncEnabled;
  const wantsHooks = isShopify && isCatalogSyncEnabled;

  if (hadHooks && !wantsHooks) {
    await removeShopifyCatalogWebhooks(tenantId).catch((e) => {
      console.warn('[shopifyWebhooks] removeShopifyCatalogWebhooks failed:', e);
    });
  }

  if (wantsHooks) {
    try {
      await ensureShopifyCatalogWebhooks(tenantId);
    } catch (e) {
      if (!wasCatalogSyncEnabled) {
        await db('tenants').where({ id: tenantId }).update({
          shopify_catalog_sync_enabled: false,
          updated_at: db.fn.now(),
        });
        throw e;
      }
      console.warn('[shopifyWebhooks] ensureShopifyCatalogWebhooks failed (catalog sync was already on):', e);
    }
  }
}
