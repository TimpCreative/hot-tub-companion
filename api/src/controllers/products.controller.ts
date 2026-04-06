import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import {
  applyShopProductJoins,
  applyListCompatibleWhere,
  getSanitizationQualifierId,
  joinPartSpaCompatibility,
  joinRequiredSanitizationQualifier,
  resolveSpaContext,
  shopCompatibilityRaw,
  spaContextIsEvaluable,
  type ShopCompatibility,
  type SpaContext,
} from '../services/shopProductCompatibility.service';
import type { Knex } from 'knex';
import { toStorefrontVariantGid } from '../utils/storefrontVariantGid';

function getTenantId(req: Request): string | null {
  return ((req as any).tenant?.id as string | undefined) ?? null;
}

function getUserId(req: Request): string | undefined {
  return (req as any).user?.id as string | undefined;
}

function parseBoolQuery(raw: string | undefined, defaultVal: boolean): boolean {
  if (raw === undefined || raw === '') return defaultVal;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return defaultVal;
}

/** categoryKey: `uhtd:<uuid>` or `ptype:<url-encoded product_type>` */
function parseCategoryKey(raw: string | undefined): { kind: 'uhtd'; id: string } | { kind: 'ptype'; value: string } | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (s.startsWith('uhtd:')) return { kind: 'uhtd', id: s.slice('uhtd:'.length) };
  if (s.startsWith('ptype:')) {
    const rest = s.slice('ptype:'.length);
    try {
      return { kind: 'ptype', value: decodeURIComponent(rest) };
    } catch {
      return { kind: 'ptype', value: rest };
    }
  }
  return null;
}

function shopSelectColumns(spaCtx: SpaContext, qualId: string | undefined, sanitizationSystem: string | null) {
  const sys = spaContextIsEvaluable(spaCtx) ? sanitizationSystem : null;
  return [
    'pp.id',
    'pp.title',
    'pp.description',
    'pp.price',
    'pp.compare_at_price',
    'pp.sku',
    'pp.barcode',
    'pp.images',
    'pp.inventory_quantity',
    'pp.product_type',
    'part.id as uhtd_part_id',
    'part.name as uhtd_part_name',
    'part.part_number as uhtd_part_number',
    'part.is_universal as uhtd_part_is_universal',
    'cat.id as category_id',
    'cat.display_name as category_name',
    'cat.sort_order as category_sort',
    'part.display_importance as part_display_importance',
    shopCompatibilityRaw(spaCtx, qualId, sys),
  ];
}

type ShopInnerFilters = {
  search?: string;
  categoryKey: ReturnType<typeof parseCategoryKey> | null;
  /** When true, only products with inventory_quantity > 0. Default true for customer shop. */
  hideOutOfStock: boolean;
  /** Minimum price in cents (pos_products.price), inclusive */
  priceMin?: number;
  /** Maximum price in cents, inclusive */
  priceMax?: number;
};

function parseOptionalPriceCents(raw: string | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function buildShopInnerQuery(
  tenantId: string,
  spaCtx: SpaContext,
  qualId: string | undefined,
  filters: ShopInnerFilters
) {
  const sanitizationSystem = spaContextIsEvaluable(spaCtx) ? spaCtx.sanitizationSystem : null;

  let inner = db('pos_products as pp');
  applyShopProductJoins(inner, tenantId, spaCtx, qualId);
  inner.select(shopSelectColumns(spaCtx, qualId, sanitizationSystem));

  const { categoryKey, search, hideOutOfStock, priceMin, priceMax } = filters;

  if (categoryKey?.kind === 'uhtd') {
    inner = inner.andWhere('cat.id', categoryKey.id);
  }
  if (categoryKey?.kind === 'ptype') {
    inner = inner.andWhere('pp.product_type', categoryKey.value);
  }

  if (search?.trim()) {
    const s = `%${search.trim()}%`;
    inner = inner.andWhere((qb: Knex.QueryBuilder) => {
      qb.where('pp.title', 'ilike', s).orWhere('pp.description', 'ilike', s);
    });
  }

  if (hideOutOfStock) {
    inner = inner.andWhere('pp.inventory_quantity', '>', 0);
  }

  if (typeof priceMin === 'number') {
    inner = inner.andWhere('pp.price', '>=', priceMin);
  }
  if (typeof priceMax === 'number') {
    inner = inner.andWhere('pp.price', '<=', priceMax);
  }

  return inner;
}

function applyShopToggles(qb: Knex.QueryBuilder, includeOtherSpaParts: boolean, includeGeneralStore: boolean): void {
  if (!includeOtherSpaParts) {
    qb.whereNot('shop_compatibility', 'other_model');
  }
  if (!includeGeneralStore) {
    qb.whereNot('shop_compatibility', 'general');
  }
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const { page = '1', pageSize = '25', search, categoryId } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  let query = db('pos_products as pp')
    .leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('part.deleted_at')
    .select(
      'pp.id',
      'pp.title',
      'pp.description',
      'pp.price',
      'pp.compare_at_price',
      'pp.sku',
      'pp.barcode',
      'pp.images',
      'pp.inventory_quantity',
      'part.id as uhtd_part_id',
      'part.name as uhtd_part_name',
      'part.part_number as uhtd_part_number',
      'part.is_universal as uhtd_part_is_universal',
      'cat.id as category_id',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort',
      'part.display_importance as part_display_importance'
    );

  if (categoryId) {
    query = query.andWhere('cat.id', categoryId);
  }

  if (search) {
    const s = `%${search}%`;
    query = query.andWhere((qb: any) => {
      qb.where('pp.title', 'ilike', s).orWhere('pp.description', 'ilike', s);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count('* as count').first();
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  const rows = await query
    .orderBy('cat.sort_order', 'asc')
    .orderBy('part.display_importance', 'asc')
    .orderBy('pp.title', 'asc')
    .limit(ps)
    .offset((p - 1) * ps);

  success(res, rows, undefined, { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) });
}

export async function getProductById(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const { id } = req.params;
  const row = await db('pos_products as pp')
    .leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.id', id)
    .select(
      'pp.*',
      'part.name as uhtd_part_name',
      'part.part_number as uhtd_part_number',
      'part.is_universal as uhtd_part_is_universal',
      'cat.id as category_id',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort'
    )
    .first();

  if (!row) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const spaProfileId = req.query.spaProfileId as string | undefined;
  if (spaProfileId?.trim()) {
    const userId = getUserId(req);
    if (!userId) {
      error(res, 'UNAUTHORIZED', 'Authentication required for spa-scoped product detail', 401);
      return;
    }
    const spaCtx = await resolveSpaContext(tenantId, userId, spaProfileId.trim());
    const qualId = await getSanitizationQualifierId();
    const inner = buildShopInnerQuery(tenantId, spaCtx, qualId, {
      categoryKey: null,
      hideOutOfStock: false,
      search: undefined,
    }).andWhere('pp.id', id);
    const sub = inner.as('t');
    const compatRow = await db.from(sub).select('shop_compatibility').first();
    const shopCompat = (compatRow as { shop_compatibility?: ShopCompatibility } | undefined)?.shop_compatibility;
    if (shopCompat) {
      (row as Record<string, unknown>).shopCompatibility = shopCompat;
    }
  }

  const posProductId = row.pos_product_id as string;
  const variantRows = await db('pos_products as pp')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.pos_product_id', posProductId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .select(
      'pp.id',
      'pp.title',
      'pp.sku',
      'pp.price',
      'pp.compare_at_price',
      'pp.inventory_quantity',
      'pp.pos_variant_id'
    )
    .orderBy('pp.title', 'asc');

  const variants = variantRows.map((v) => ({
    id: v.id as string,
    title: v.title as string,
    sku: (v.sku as string | null) ?? null,
    price: v.price as number,
    compare_at_price: (v.compare_at_price as number | null) ?? null,
    inventory_quantity: typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0,
    storefrontVariantGid: toStorefrontVariantGid(v.pos_variant_id as string | null) ?? null,
    isSelected: (v.id as string) === id,
  }));

  (row as Record<string, unknown>).variants = variants;

  success(res, row);
}

export async function listProductCategories(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const rows = await db('pcdb_categories as cat')
    .distinct('cat.id', 'cat.name', 'cat.display_name', 'cat.sort_order')
    .join('pcdb_parts as part', 'cat.id', 'part.category_id')
    .join('pos_products as pp', 'part.id', 'pp.uhtd_part_id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('cat.deleted_at')
    .whereNull('part.deleted_at')
    .orderBy('cat.sort_order', 'asc');

  success(res, rows);
}

export async function listShopProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const spaProfileId = req.query.spaProfileId as string | undefined;
  const includeOtherSpaParts = parseBoolQuery(req.query.includeOtherSpaParts as string, false);
  const includeGeneralStore = parseBoolQuery(req.query.includeGeneralStore as string, true);
  const hideOutOfStock = parseBoolQuery(req.query.hideOutOfStock as string, true);
  const { page = '1', pageSize = '20', search } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const categoryKey = parseCategoryKey(req.query.categoryKey as string | undefined);
  const priceMin = parseOptionalPriceCents(req.query.priceMin as string | undefined);
  const priceMax = parseOptionalPriceCents(req.query.priceMax as string | undefined);

  const spaCtx = await resolveSpaContext(tenantId, userId, spaProfileId?.trim() || undefined);
  const qualId = await getSanitizationQualifierId();

  const inner = buildShopInnerQuery(tenantId, spaCtx, qualId, {
    search,
    categoryKey,
    hideOutOfStock,
    priceMin,
    priceMax,
  });
  const sub = inner.as('shop_inner');
  let outer = db.from(sub);
  applyShopToggles(outer, includeOtherSpaParts, includeGeneralStore);

  const countRow = await outer.clone().clearSelect().clearOrder().count('* as count').first();
  const total = parseInt(String((countRow as { count?: string })?.count ?? '0'), 10);

  const rows = await outer
    .clone()
    .orderByRaw(`CASE shop_compatibility
      WHEN 'compatible' THEN 0
      WHEN 'needs_spa' THEN 1
      WHEN 'general' THEN 2
      WHEN 'other_model' THEN 3
      ELSE 4 END`)
    .orderBy('category_sort', 'asc')
    .orderBy('part_display_importance', 'asc')
    .orderBy('title', 'asc')
    .limit(ps)
    .offset((p - 1) * ps);

  success(res, rows, undefined, {
    page: p,
    pageSize: ps,
    total,
    totalPages: Math.ceil(total / ps),
  });
}

/** Same-category or same-product_type peers visible in the current shop filters (tenant + spa). */
export async function listRelatedShopProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const { id } = req.params;
  if (!id?.trim()) {
    error(res, 'VALIDATION_ERROR', 'Product id is required', 400);
    return;
  }

  const spaProfileId = req.query.spaProfileId as string | undefined;
  const includeOtherSpaParts = parseBoolQuery(req.query.includeOtherSpaParts as string, false);
  const includeGeneralStore = parseBoolQuery(req.query.includeGeneralStore as string, true);
  const hideOutOfStock = parseBoolQuery(req.query.hideOutOfStock as string, true);
  const limitRaw = parseInt(String(req.query.limit ?? '6'), 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 6));

  const anchor = await db('pos_products as pp')
    .leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.id', id.trim())
    .whereNull('part.deleted_at')
    .select('pp.product_type', 'cat.id as category_id')
    .first();

  if (!anchor) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const categoryId = anchor.category_id as string | null | undefined;
  const productType =
    anchor.product_type != null && String(anchor.product_type).trim() !== ''
      ? String(anchor.product_type).trim()
      : null;

  if (!categoryId && !productType) {
    success(res, []);
    return;
  }

  const spaCtx = await resolveSpaContext(tenantId, userId, spaProfileId?.trim() || undefined);
  const qualId = await getSanitizationQualifierId();

  const inner = buildShopInnerQuery(tenantId, spaCtx, qualId, {
    categoryKey: null,
    hideOutOfStock,
    search: undefined,
  });
  const sub = inner.as('shop_inner');
  let outer = db.from(sub);
  applyShopToggles(outer, includeOtherSpaParts, includeGeneralStore);

  let related = outer
    .clone()
    .whereNot('id', id.trim())
    .andWhere((qb: Knex.QueryBuilder) => {
      if (categoryId && productType) {
        qb.where('category_id', categoryId).orWhere('product_type', productType);
      } else if (categoryId) {
        qb.where('category_id', categoryId);
      } else if (productType) {
        qb.where('product_type', productType);
      }
    })
    .orderByRaw(`CASE shop_compatibility
      WHEN 'compatible' THEN 0
      WHEN 'needs_spa' THEN 1
      WHEN 'general' THEN 2
      WHEN 'other_model' THEN 3
      ELSE 4 END`)
    .orderBy('category_sort', 'asc')
    .orderBy('part_display_importance', 'asc')
    .orderBy('title', 'asc')
    .limit(limit);

  const rows = await related.select(
    'id',
    'title',
    'price',
    'compare_at_price',
    'images',
    'inventory_quantity',
    'shop_compatibility'
  );

  success(res, rows);
}

/** Min/max price in cents for the current shop criteria, excluding any price-range filter. */
export async function listShopPriceBounds(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const spaProfileId = req.query.spaProfileId as string | undefined;
  const includeOtherSpaParts = parseBoolQuery(req.query.includeOtherSpaParts as string, false);
  const includeGeneralStore = parseBoolQuery(req.query.includeGeneralStore as string, true);
  const hideOutOfStock = parseBoolQuery(req.query.hideOutOfStock as string, true);
  const { search } = req.query as Record<string, string>;
  const categoryKey = parseCategoryKey(req.query.categoryKey as string | undefined);

  const spaCtx = await resolveSpaContext(tenantId, userId, spaProfileId?.trim() || undefined);
  const qualId = await getSanitizationQualifierId();

  const inner = buildShopInnerQuery(tenantId, spaCtx, qualId, {
    search,
    categoryKey,
    hideOutOfStock,
  });
  const sub = inner.as('shop_inner');
  let outer = db.from(sub);
  applyShopToggles(outer, includeOtherSpaParts, includeGeneralStore);

  // Use a single raw select: chained .min().max() is unreliable with some Knex/pg setups, and
  // unquoted aliases become lowercase in PostgreSQL (mincents), which broke parsing.
  const row = await outer
    .clone()
    .clearOrder()
    .clearSelect()
    .select(
      db.raw(
        'MIN(price) FILTER (WHERE price IS NOT NULL) AS "minCents", MAX(price) FILTER (WHERE price IS NOT NULL) AS "maxCents"'
      )
    )
    .first();

  const raw = row as Record<string, unknown> | undefined;
  const parseAgg = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const minCents = parseAgg(raw?.minCents ?? raw?.mincents);
  const maxCents = parseAgg(raw?.maxCents ?? raw?.maxcents);

  success(res, {
    minCents,
    maxCents:
      minCents != null && maxCents != null && maxCents < minCents
        ? minCents
        : maxCents,
  });
}

export async function listShopCategories(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const spaProfileId = req.query.spaProfileId as string | undefined;
  const includeOtherSpaParts = parseBoolQuery(req.query.includeOtherSpaParts as string, false);
  const includeGeneralStore = parseBoolQuery(req.query.includeGeneralStore as string, true);
  const hideOutOfStock = parseBoolQuery(req.query.hideOutOfStock as string, true);
  const priceMin = parseOptionalPriceCents(req.query.priceMin as string | undefined);
  const priceMax = parseOptionalPriceCents(req.query.priceMax as string | undefined);

  const spaCtx = await resolveSpaContext(tenantId, userId, spaProfileId?.trim() || undefined);
  const qualId = await getSanitizationQualifierId();

  // No category or search: categories stay stable while user types or picks a single category in the UI
  const inner = buildShopInnerQuery(tenantId, spaCtx, qualId, {
    categoryKey: null,
    search: undefined,
    hideOutOfStock,
    priceMin,
    priceMax,
  });
  const sub = inner.as('shop_inner');
  let filtered = db.from(sub);
  applyShopToggles(filtered, includeOtherSpaParts, includeGeneralStore);

  const uhtdRows = await filtered
    .clone()
    .whereNotNull('category_id')
    .select('category_id as id', 'category_name as display_name', 'category_sort as sort_order')
    .groupBy('category_id', 'category_name', 'category_sort')
    .orderBy('category_sort', 'asc');

  const uhtdSorted = uhtdRows as { id: string; display_name: string | null; sort_order: number | null }[];

  const typeRows = await filtered
    .clone()
    .whereNotNull('product_type')
    .andWhere('product_type', '<>', '')
    .select('product_type')
    .groupBy('product_type')
    .orderBy('product_type', 'asc');

  const out: Array<
    | { kind: 'uhtd'; id: string; displayName: string; sortOrder: number | null }
    | { kind: 'product_type'; key: string; displayName: string }
  > = [];

  for (const r of uhtdSorted) {
    if (!r.id) continue;
    out.push({
      kind: 'uhtd',
      id: r.id,
      displayName: r.display_name || r.id,
      sortOrder: r.sort_order != null ? Number(r.sort_order) : null,
    });
  }

  for (const r of typeRows as { product_type: string }[]) {
    out.push({
      kind: 'product_type',
      key: r.product_type,
      displayName: r.product_type,
    });
  }

  success(res, out);
}

export async function listCompatibleProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const userId = getUserId(req);
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const { spaProfileId } = req.params;
  const spa = await db('spa_profiles')
    .where({ id: spaProfileId, tenant_id: tenantId, user_id: userId })
    .select('id', 'uhtd_spa_model_id', 'sanitization_system')
    .first();

  if (!spa) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }
  if (!spa.uhtd_spa_model_id) {
    success(res, [], 'Spa profile is not linked to a UHTD model yet');
    return;
  }

  const spaModelId = spa.uhtd_spa_model_id as string;
  const sanitizationQualifierId = await getSanitizationQualifierId();
  const spaCtx: SpaContext = {
    kind: 'ok',
    spaModelId,
    sanitizationSystem: (spa.sanitization_system as string) ?? null,
  };

  let query = db('pos_products as pp')
    .join('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .join('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('part.deleted_at');

  joinPartSpaCompatibility(query, spaCtx);
  joinRequiredSanitizationQualifier(query, spaCtx, sanitizationQualifierId);

  applyListCompatibleWhere(query, (spa.sanitization_system as string) ?? null, sanitizationQualifierId);

  const { page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const countRow = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .countDistinct('pp.id as count')
    .first();
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  const rows = await query
    .select(
      'pp.id',
      'pp.title',
      'pp.description',
      'pp.price',
      'pp.compare_at_price',
      'pp.sku',
      'pp.barcode',
      'pp.images',
      'pp.inventory_quantity',
      'part.part_number',
      'part.name as uhtd_part_name',
      'part.is_oem',
      'part.is_universal',
      'part.display_importance',
      'psc.quantity_required',
      'psc.position',
      'psc.fit_notes',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort'
    )
    .orderBy('cat.sort_order', 'asc')
    .orderBy('part.display_importance', 'asc')
    .orderBy('pp.title', 'asc')
    .limit(ps)
    .offset((p - 1) * ps);

  success(res, rows, undefined, { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) });
}
