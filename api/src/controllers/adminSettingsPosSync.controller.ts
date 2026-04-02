import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import { getPosAdapter } from '../services/posAdapterRegistry';
import {
  getShopifyCatalogSyncEstimate,
  syncShopifyCatalogPage,
} from '../integrations/shopifyAdapter';
import { logPosIntegrationActivity, retailerPosActivityActor } from '../services/posIntegrationActivity.service';

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

/**
 * Full incremental server-side sync (single HTTP request; may timeout on huge catalogs).
 */
export async function syncCatalogNow(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const adapter = getPosAdapter(tenant.pos_type);
  if (!adapter) {
    error(res, 'CONFIG_ERROR', 'No POS adapter configured for this tenant', 400);
    return;
  }

  const existingPosProduct = await db('pos_products').where({ tenant_id: tenantId }).select('id').first();
  const hasAnyPosProducts = !!existingPosProduct;

  const since =
    hasAnyPosProducts && tenant.last_product_sync_at
      ? new Date(tenant.last_product_sync_at)
      : undefined;

  try {
    const summary = await adapter.syncCatalog(tenant.id, {
      full: false,
      since,
    });

    await db('tenants').where({ id: tenant.id }).update({ last_product_sync_at: new Date() });

    const actor = retailerPosActivityActor(req);
    await logPosIntegrationActivity(tenantId, {
      eventType: 'sync_incremental_now',
      summary: `Incremental catalog sync (one request): ${summary.created} created, ${summary.updated} updated`,
      source: 'retailer_admin',
      actorUserId: actor.actorUserId,
      actorLabel: actor.actorLabel,
      metadata: {
        created: summary.created,
        updated: summary.updated,
        errorCount: summary.errors.length,
      },
    });

    success(res, summary);
  } catch (err: any) {
    error(res, 'SYNC_ERROR', err?.message || 'Catalog sync failed', 502);
  }
}

export async function getProductSyncEstimate(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  if (tenant.pos_type !== 'shopify') {
    error(res, 'CONFIG_ERROR', 'Catalog sync estimate is only available for Shopify tenants', 400);
    return;
  }

  try {
    const estimate = await getShopifyCatalogSyncEstimate(tenantId);
    success(res, estimate);
  } catch (err: any) {
    error(res, 'UPSTREAM_ERROR', err?.message || 'Failed to fetch Shopify product count', 502);
  }
}

type SyncBatchMode = 'full' | 'incremental';

export async function syncProductBatch(req: Request, res: Response): Promise<void> {
  const tenantId = requireManageSettings(req, res);
  if (!tenantId) return;

  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }
  if (tenant.pos_type !== 'shopify') {
    error(res, 'CONFIG_ERROR', 'Batched catalog sync is only available for Shopify tenants', 400);
    return;
  }

  const body = req.body as { pageInfo?: string | null; mode?: SyncBatchMode };
  const mode: SyncBatchMode = body.mode === 'incremental' ? 'incremental' : 'full';
  const pageInfo =
    typeof body.pageInfo === 'string' && body.pageInfo.length > 0 ? body.pageInfo : null;

  const existingPosProduct = await db('pos_products').where({ tenant_id: tenantId }).select('id').first();
  const hasAnyPosProducts = !!existingPosProduct;

  let since: Date | undefined;
  if (mode === 'incremental') {
    if (!pageInfo && hasAnyPosProducts && tenant.last_product_sync_at) {
      since = new Date(tenant.last_product_sync_at);
    }
  }

  try {
    const batch = await syncShopifyCatalogPage(tenantId, {
      pageInfo,
      mode,
      since,
    });

    if (!batch.nextPageInfo) {
      await db('tenants').where({ id: tenant.id }).update({ last_product_sync_at: new Date() });
    }

    const actor = retailerPosActivityActor(req);
    await logPosIntegrationActivity(tenantId, {
      eventType: 'sync_catalog_batch',
      summary: `${mode === 'full' ? 'Full' : 'Incremental'} import page: ${batch.productsInPage} product(s), +${batch.created} created, ${batch.updated} updated${!batch.nextPageInfo ? ' (run complete)' : ''}`,
      source: 'retailer_admin',
      actorUserId: actor.actorUserId,
      actorLabel: actor.actorLabel,
      metadata: {
        mode,
        productsInPage: batch.productsInPage,
        created: batch.created,
        updated: batch.updated,
        done: !batch.nextPageInfo,
        errorCount: batch.errors.length,
      },
    });

    success(res, {
      created: batch.created,
      updated: batch.updated,
      deletedOrArchived: batch.deletedOrArchived,
      errors: batch.errors,
      nextPageInfo: batch.nextPageInfo,
      productsInPage: batch.productsInPage,
      done: !batch.nextPageInfo,
    });
  } catch (err: any) {
    error(res, 'SYNC_ERROR', err?.message || 'Catalog sync batch failed', 502);
  }
}
