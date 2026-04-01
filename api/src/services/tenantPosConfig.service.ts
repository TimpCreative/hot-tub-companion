import { db } from '../config/database';
import { encryptTenantSecret } from '../utils/tenantSecrets';
import { getPosAdapter } from './posAdapterRegistry';

type TenantRow = {
  id: string;
  pos_type: string | null;
  shopify_store_url: string | null;
  shopify_storefront_token: string | null;
  shopify_admin_token: string | null;
  shopify_webhook_secret: string | null;
  last_product_sync_at: Date | string | null;
};

export interface PosConfigSummary {
  tenantId: string;
  posType: string | null;
  shopifyStoreUrl: string | null;
  lastProductSyncAt: Date | string | null;
  shopifyStorefrontTokenConfigured: boolean;
  shopifyAdminTokenConfigured: boolean;
  shopifyWebhookSecretConfigured: boolean;
}

export interface UpdateTenantPosConfigInput {
  posType?: string | null;
  shopifyStoreUrl?: string | null;
  shopifyStorefrontToken?: string | null;
  shopifyAdminToken?: string | null;
  shopifyWebhookSecret?: string | null;
}

function mapSummary(tenant: TenantRow): PosConfigSummary {
  return {
    tenantId: tenant.id,
    posType: tenant.pos_type,
    shopifyStoreUrl: tenant.shopify_store_url,
    lastProductSyncAt: tenant.last_product_sync_at,
    shopifyStorefrontTokenConfigured: !!tenant.shopify_storefront_token,
    shopifyAdminTokenConfigured: !!tenant.shopify_admin_token,
    shopifyWebhookSecretConfigured: !!tenant.shopify_webhook_secret,
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
  if (input.shopifyStoreUrl !== undefined) insert.shopify_store_url = input.shopifyStoreUrl;
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
    const normalized = input.shopifyStoreUrl === null ? null : input.shopifyStoreUrl.trim() || null;
    update.shopify_store_url = normalized;
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
