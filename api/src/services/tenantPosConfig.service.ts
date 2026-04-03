import { db } from '../config/database';
import { encryptTenantSecret } from '../utils/tenantSecrets';
import { getPosAdapter } from './posAdapterRegistry';

export function normalizeShopDomain(domain: string): string {
  const s = domain.trim().toLowerCase();
  if (s.startsWith('https://')) return s.slice(8).replace(/\/.*$/, '');
  if (s.startsWith('http://')) return s.slice(7).replace(/\/.*$/, '');
  return s.split('/')[0];
}

type TenantRow = {
  id: string;
  pos_type: string | null;
  shopify_store_url: string | null;
  shopify_client_id: string | null;
  shopify_client_secret: string | null;
  shopify_storefront_token: string | null;
  shopify_admin_token: string | null;
  shopify_webhook_secret: string | null;
  last_product_sync_at: Date | string | null;
  product_sync_interval_minutes: number | null;
  shopify_catalog_sync_enabled: boolean;
  last_cron_product_sync_at: Date | string | null;
  shopify_webhook_subscription_ids: unknown | null;
  pos_integration_last_activity_at: Date | string | null;
};

export interface PosConfigSummary {
  tenantId: string;
  posType: string | null;
  shopifyStoreUrl: string | null;
  shopifyClientId: string | null;
  lastProductSyncAt: Date | string | null;
  productSyncIntervalMinutes: number;
  shopifyCatalogSyncEnabled: boolean;
  lastCronProductSyncAt: Date | string | null;
  shopifyClientSecretConfigured: boolean;
  shopifyStorefrontTokenConfigured: boolean;
  shopifyAdminTokenConfigured: boolean;
  shopifyWebhookSecretConfigured: boolean;
  /** Latest POS integration activity (webhook, sync, settings save, etc.) */
  posIntegrationLastActivityAt: Date | string | null;
}

export interface UpdateTenantPosConfigInput {
  posType?: string | null;
  shopifyStoreUrl?: string | null;
  shopifyClientId?: string | null;
  shopifyClientSecret?: string | null;
  shopifyStorefrontToken?: string | null;
  shopifyAdminToken?: string | null;
  shopifyWebhookSecret?: string | null;
  shopifyCatalogSyncEnabled?: boolean;
  productSyncIntervalMinutes?: number | null;
}

function mapSummary(tenant: TenantRow): PosConfigSummary {
  const interval =
    typeof tenant.product_sync_interval_minutes === 'number' &&
    Number.isFinite(tenant.product_sync_interval_minutes)
      ? tenant.product_sync_interval_minutes
      : 30;
  return {
    tenantId: tenant.id,
    posType: tenant.pos_type,
    shopifyStoreUrl: tenant.shopify_store_url,
    shopifyClientId: tenant.shopify_client_id,
    lastProductSyncAt: tenant.last_product_sync_at,
    productSyncIntervalMinutes: interval,
    shopifyCatalogSyncEnabled: !!tenant.shopify_catalog_sync_enabled,
    lastCronProductSyncAt: tenant.last_cron_product_sync_at ?? null,
    shopifyClientSecretConfigured: !!tenant.shopify_client_secret,
    shopifyStorefrontTokenConfigured: !!tenant.shopify_storefront_token,
    shopifyAdminTokenConfigured: !!tenant.shopify_admin_token,
    shopifyWebhookSecretConfigured: !!tenant.shopify_webhook_secret,
    posIntegrationLastActivityAt: tenant.pos_integration_last_activity_at ?? null,
  };
}

export async function getTenantPosSummary(tenantId: string): Promise<PosConfigSummary | null> {
  const tenant = await db<TenantRow>('tenants').where({ id: tenantId }).first();
  if (!tenant) return null;
  return mapSummary(tenant);
}

export function buildPosSecretInsert(input: UpdateTenantPosConfigInput): Record<string, unknown> {
  const insert: Record<string, unknown> = {};
  if (input.posType !== undefined) insert.pos_type = input.posType;
  if (input.shopifyStoreUrl !== undefined) {
    insert.shopify_store_url =
      input.shopifyStoreUrl === null ? null : normalizeShopDomain(input.shopifyStoreUrl);
  }
  if (input.shopifyClientId !== undefined) {
    insert.shopify_client_id =
      input.shopifyClientId === null ? null : input.shopifyClientId.trim() || null;
  }
  if (input.shopifyClientSecret !== undefined) {
    insert.shopify_client_secret =
      input.shopifyClientSecret === null ? null : encryptTenantSecret(input.shopifyClientSecret);
  }
  if (input.shopifyStorefrontToken !== undefined) {
    insert.shopify_storefront_token =
      input.shopifyStorefrontToken === null ? null : encryptTenantSecret(input.shopifyStorefrontToken);
  }
  if (input.shopifyAdminToken !== undefined) {
    insert.shopify_admin_token =
      input.shopifyAdminToken === null ? null : encryptTenantSecret(input.shopifyAdminToken);
  }
  if (input.shopifyWebhookSecret !== undefined) {
    insert.shopify_webhook_secret =
      input.shopifyWebhookSecret === null ? null : encryptTenantSecret(input.shopifyWebhookSecret);
  }
  return insert;
}

export async function updateTenantPosConfig(
  tenantId: string,
  input: UpdateTenantPosConfigInput
): Promise<PosConfigSummary> {
  const update: Record<string, unknown> = {};

  if (input.posType !== undefined) {
    if (input.posType !== null && input.posType !== 'shopify') {
      throw new Error('Unsupported POS type for this phase');
    }
    update.pos_type = input.posType;
  }

  if (input.shopifyStoreUrl !== undefined) {
    const normalized =
      input.shopifyStoreUrl === null ? null : normalizeShopDomain(input.shopifyStoreUrl);
    update.shopify_store_url = normalized;
  }

  if (input.shopifyClientId !== undefined) {
    update.shopify_client_id =
      input.shopifyClientId === null ? null : input.shopifyClientId.trim() || null;
  }

  if (input.shopifyClientSecret !== undefined) {
    update.shopify_client_secret =
      input.shopifyClientSecret === null ? null : encryptTenantSecret(input.shopifyClientSecret);
  }

  if (input.shopifyStorefrontToken !== undefined) {
    update.shopify_storefront_token =
      input.shopifyStorefrontToken === null ? null : encryptTenantSecret(input.shopifyStorefrontToken);
  }

  if (input.shopifyAdminToken !== undefined) {
    update.shopify_admin_token =
      input.shopifyAdminToken === null ? null : encryptTenantSecret(input.shopifyAdminToken);
  }

  if (input.shopifyWebhookSecret !== undefined) {
    update.shopify_webhook_secret =
      input.shopifyWebhookSecret === null ? null : encryptTenantSecret(input.shopifyWebhookSecret);
  }

  if (input.shopifyCatalogSyncEnabled !== undefined) {
    update.shopify_catalog_sync_enabled = input.shopifyCatalogSyncEnabled;
  }

  if (input.productSyncIntervalMinutes !== undefined) {
    if (input.productSyncIntervalMinutes === null) {
      update.product_sync_interval_minutes = 30;
    } else {
      const n = Math.floor(Number(input.productSyncIntervalMinutes));
      update.product_sync_interval_minutes = Math.min(1440, Math.max(1, n));
    }
  }

  if (Object.keys(update).length === 0) {
    const existing = await getTenantPosSummary(tenantId);
    if (!existing) throw new Error('Tenant not found');
    return existing;
  }

  const [updated] = await db<TenantRow>('tenants').where({ id: tenantId }).update(update).returning('*');
  if (!updated) {
    throw new Error('Tenant not found');
  }
  return mapSummary(updated);
}

export async function testTenantPosConnection(tenantId: string) {
  const tenant = await db<TenantRow>('tenants').where({ id: tenantId }).first();
  if (!tenant) throw new Error('Tenant not found');

  const adapter = getPosAdapter(tenant.pos_type);
  if (!adapter) {
    throw new Error('No POS adapter configured for this tenant');
  }

  return adapter.testConnection(tenant.id);
}
