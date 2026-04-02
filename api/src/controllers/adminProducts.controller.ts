import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { getPosAdapter } from '../services/posAdapterRegistry';
import {
  getShopifyCatalogSyncEstimate,
  syncShopifyCatalogPage,
} from '../integrations/shopifyAdapter';

function requireManageProducts(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_products === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_products', 403);
    return false;
  }
  return true;
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const {
    mappingStatus,
    isHidden,
    search,
    page = '1',
    pageSize = '25',
  } = req.query as Record<string, string>;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  let query = db('pos_products')
    .where({ tenant_id: tenantId })
    .select(
      'id',
      'title',
      'sku',
      'barcode',
      'price',
      'inventory_quantity',
      'mapping_status',
      'mapping_confidence',
      'is_hidden',
      'uhtd_part_id',
      'pos_product_id',
      'pos_variant_id',
      'last_synced_at',
      'updated_at'
    );

  if (mappingStatus) {
    query = query.where('mapping_status', mappingStatus);
  }
  if (isHidden === 'true') query = query.where('is_hidden', true);
  if (isHidden === 'false') query = query.where('is_hidden', false);

  if (search) {
    const s = `%${search}%`;
    query = query.where((qb: any) => {
      qb.where('title', 'ilike', s).orWhere('sku', 'ilike', s).orWhere('barcode', 'ilike', s);
    });
  }

  const countQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
  query = query
    .orderBy('updated_at', 'desc')
    .limit(ps)
    .offset((p - 1) * ps);

  const [rows, countRow] = await Promise.all([query, countQuery]);
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  success(
    res,
    rows,
    undefined,
    { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) }
  );
}

export async function setVisibility(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  const { isHidden } = req.body as { isHidden?: boolean };

  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (typeof isHidden !== 'boolean') {
    error(res, 'VALIDATION_ERROR', 'isHidden boolean is required', 400);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      is_hidden: isHidden,
      hidden_at: isHidden ? db.fn.now() : null,
      hidden_by: isHidden ? userId ?? null : null,
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}

export async function getUhtdSuggestions(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  const { id } = req.params;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const product = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .select('id', 'title', 'sku', 'barcode')
    .first();

  if (!product) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const suggestions: Array<{ partId: string; name: string; partNumber: string | null; manufacturer: string | null; score: number; reason: string }> = [];

  // 1) Barcode match (highest confidence)
  if (product.barcode) {
    const barcodeMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) => qb.where('upc', product.barcode).orWhere('ean', product.barcode))
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer');

    for (const m of barcodeMatches) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: 0.95,
        reason: 'barcode',
      });
    }
  }

  // 2) SKU / part_number match
  if (product.sku) {
    const skuMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) =>
        qb.whereRaw('LOWER(part_number) = LOWER(?)', [product.sku])
          .orWhereRaw('? = ANY(sku_aliases)', [product.sku])
      )
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer');

    for (const m of skuMatches) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: 0.75,
        reason: 'sku',
      });
    }
  }

  // 3) Name similarity (fallback)
  if (product.title) {
    const nameMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        db.raw('similarity(name, ?) as score', [product.title])
      )
      .whereRaw('similarity(name, ?) >= 0.15', [product.title])
      .orderBy('score', 'desc')
      .limit(10);

    for (const m of nameMatches as any[]) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: Number(m.score) || 0,
        reason: 'name_similarity',
      });
    }
  }

  // Deduplicate by partId, keep best score
  const best = new Map<string, typeof suggestions[number]>();
  for (const s of suggestions) {
    const cur = best.get(s.partId);
    if (!cur || s.score > cur.score) best.set(s.partId, s);
  }

  const out = Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, 10);
  success(res, out);
}

export async function confirmMapping(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  const { uhtdPartId, mappingConfidence } = req.body as { uhtdPartId?: string; mappingConfidence?: number };

  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!uhtdPartId) {
    error(res, 'VALIDATION_ERROR', 'uhtdPartId is required', 400);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const part = await db('pcdb_parts').where({ id: uhtdPartId }).whereNull('deleted_at').first();
  if (!part) {
    error(res, 'NOT_FOUND', 'UHTD part not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      uhtd_part_id: uhtdPartId,
      mapping_status: 'confirmed',
      mapping_confidence: typeof mappingConfidence === 'number' ? mappingConfidence : null,
      mapped_by: userId ?? null,
      mapped_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}

export async function clearMapping(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  const { id } = req.params;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      uhtd_part_id: null,
      mapping_status: 'unmapped',
      mapping_confidence: null,
      mapped_by: null,
      mapped_at: null,
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}

export async function syncNow(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

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

  // If this tenant has never imported any POS products, don't apply an
  // incremental `updated_at_min` cutoff. Otherwise we can "skip" the initial
  // sync forever if `last_product_sync_at` was set during an earlier empty run.
  const existingPosProduct = await db('pos_products').where({ tenant_id: tenantId }).select('id').first();
  const hasAnyPosProducts = !!existingPosProduct;

  const since =
    hasAnyPosProducts && tenant.last_product_sync_at
      ? new Date(tenant.last_product_sync_at)
      : undefined;

  const summary = await adapter.syncCatalog(tenant.id, {
    full: false,
    since,
  });

  await db('tenants').where({ id: tenant.id }).update({ last_product_sync_at: new Date() });

  success(res, summary);
}

/**
 * Shopify-only: estimated pages for catalog import (GET /products/count + limit 250).
 */
export async function getProductSyncEstimate(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

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
    error(
      res,
      'UPSTREAM_ERROR',
      err?.message || 'Failed to fetch Shopify product count',
      502
    );
  }
}

type SyncBatchMode = 'full' | 'incremental';

/**
 * Shopify-only: sync one REST page so dashboards can show progress without long single requests.
 */
export async function syncProductBatch(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

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

