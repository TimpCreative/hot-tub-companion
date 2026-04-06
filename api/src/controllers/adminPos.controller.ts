import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import {
  getTenantPosSummary,
  testTenantPosConnection,
  updateTenantPosConfig,
} from '../services/tenantPosConfig.service';
import { ensureCanonicalShopifyStoreDomain } from '../services/shopifyAuth.service';
import { ensureStorefrontAccessTokenStored } from '../services/shopifyStorefrontToken.service';
import { reconcileShopifyCatalogWebhooks } from '../services/shopifyWebhooks.service';
import {
  listPosIntegrationActivity,
  logPosIntegrationActivity,
  retailerPosActivityActor,
} from '../services/posIntegrationActivity.service';

function requireManageSettings(req: Request, res: Response): string | null {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return null;
  }

  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return null;
  }
  return tenantId;
}

export async function getPosConfig(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const summary = await getTenantPosSummary(tenantId);
  if (!summary) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, summary);
}

export async function getPosIntegrationActivity(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

  const { items, total } = await listPosIntegrationActivity(tenantId, page, pageSize);
  success(res, items, undefined, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

/** Read-only POS / sync health snapshot for retailer admin dashboards. */
export async function getPosHealth(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const t = (await db('tenants')
    .where({ id: tenantId })
    .select(
      'last_product_sync_at',
      'last_cron_product_sync_at',
      'pos_integration_last_activity_at',
      'shopify_catalog_sync_enabled'
    )
    .first()) as {
    last_product_sync_at: Date | string | null;
    last_cron_product_sync_at: Date | string | null;
    pos_integration_last_activity_at: Date | string | null;
    shopify_catalog_sync_enabled: boolean;
  } | undefined;

  if (!t) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const lastFailure = await db('pos_integration_activity')
    .where({ tenant_id: tenantId })
    .where((qb) => {
      qb.whereILike('event_type', '%fail%')
        .orWhereILike('event_type', '%error%')
        .orWhereILike('summary', '%fail%')
        .orWhereILike('summary', '%error%');
    })
    .orderBy('created_at', 'desc')
    .select('event_type', 'summary', 'created_at', 'source')
    .first();

  success(res, {
    lastProductSyncAt: t.last_product_sync_at ?? null,
    lastCronProductSyncAt: t.last_cron_product_sync_at ?? null,
    posIntegrationLastActivityAt: t.pos_integration_last_activity_at ?? null,
    shopifyCatalogSyncEnabled: !!t.shopify_catalog_sync_enabled,
    lastLoggedFailure: lastFailure
      ? {
          eventType: lastFailure.event_type as string,
          summary: lastFailure.summary as string,
          source: lastFailure.source as string,
          createdAt: lastFailure.created_at,
        }
      : null,
  });
}

export async function updatePosConfig(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const prev = await db('tenants')
    .where({ id: tenantId })
    .select('pos_type', 'shopify_catalog_sync_enabled')
    .first();

  const {
    posType,
    shopifyStoreUrl,
    shopifyClientId,
    shopifyClientSecret,
    shopifyStorefrontToken,
    shopifyAdminToken,
    shopifyWebhookSecret,
    shopifyCatalogSyncEnabled,
    productSyncIntervalMinutes,
  } = req.body as {
    posType?: string | null;
    shopifyStoreUrl?: string | null;
    shopifyClientId?: string | null;
    shopifyClientSecret?: string | null;
    shopifyStorefrontToken?: string | null;
    shopifyAdminToken?: string | null;
    shopifyWebhookSecret?: string | null;
    shopifyCatalogSyncEnabled?: boolean;
    productSyncIntervalMinutes?: number | null;
  };

  try {
    const summary = await updateTenantPosConfig(tenantId, {
      posType,
      shopifyStoreUrl,
      shopifyClientId,
      shopifyClientSecret,
      shopifyStorefrontToken,
      shopifyAdminToken,
      shopifyWebhookSecret,
      shopifyCatalogSyncEnabled,
      productSyncIntervalMinutes,
    });
    const actor = retailerPosActivityActor(req);
    if (summary.posType === 'shopify') {
      await ensureCanonicalShopifyStoreDomain(tenantId);
      const storefrontProvision = await ensureStorefrontAccessTokenStored(tenantId);
      if (!storefrontProvision.ok) {
        await logPosIntegrationActivity(tenantId, {
          eventType: 'storefront_token_provision_failed',
          summary: 'Could not auto-create Storefront API token',
          metadata: { reason: storefrontProvision.reason },
          source: 'retailer_admin',
          actorUserId: actor.actorUserId,
          actorLabel: actor.actorLabel,
        });
      }
    }
    await reconcileShopifyCatalogWebhooks({
      tenantId,
      wasShopify: prev?.pos_type === 'shopify',
      wasCatalogSyncEnabled: !!prev?.shopify_catalog_sync_enabled,
      isShopify: summary.posType === 'shopify',
      isCatalogSyncEnabled: summary.shopifyCatalogSyncEnabled,
    });
    await logPosIntegrationActivity(tenantId, {
      eventType: 'pos_settings_saved',
      summary: 'POS settings saved',
      metadata: {
        posType: summary.posType,
        catalogSyncEnabled: summary.shopifyCatalogSyncEnabled,
        productSyncIntervalMinutes: summary.productSyncIntervalMinutes,
      },
      source: 'retailer_admin',
      actorUserId: actor.actorUserId,
      actorLabel: actor.actorLabel,
    });
    const fresh = await getTenantPosSummary(tenantId);
    success(res, fresh ?? summary, 'POS configuration saved');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update POS configuration';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'Unsupported POS type for this phase') {
      error(res, 'VALIDATION_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}

export async function testPosConnection(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  try {
    const result = await testTenantPosConnection(tenantId);
    if (result.ok) {
      const tenant = await db('tenants').where({ id: tenantId }).select('pos_type').first();
      if (tenant?.pos_type === 'shopify') {
        await ensureStorefrontAccessTokenStored(tenantId);
      }
    }
    if (!result.ok) {
      const code = (result.details as { code?: string } | undefined)?.code;
      if (code === 'DOMAIN_MISMATCH') {
        error(res, 'DOMAIN_MISMATCH', result.message || 'Shop domain mismatch', 400);
        return;
      }
      if (code === 'AUTH_ERROR') {
        error(res, 'AUTH_ERROR', result.message || 'Shopify authentication failed', 400);
        return;
      }
      if (code === 'CONFIG_ERROR') {
        error(res, 'CONFIG_ERROR', result.message || 'Shopify configuration is incomplete', 400);
        return;
      }
      error(res, 'INTERNAL_ERROR', result.message || 'Shopify connection test failed', 500);
      return;
    }
    success(res, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to test POS connection';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'No POS adapter configured for this tenant') {
      error(res, 'CONFIG_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}
