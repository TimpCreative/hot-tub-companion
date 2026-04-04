import type { Knex } from 'knex';

export const ADMIN_PRODUCT_SORTS = [
  'updated_at_desc',
  'updated_at_asc',
  'title_asc',
  'title_desc',
  'price_asc',
  'price_desc',
  'inventory_desc',
  'inventory_asc',
  'is_hidden_asc',
  'is_hidden_desc',
  'mapping_status_asc',
  'mapping_status_desc',
  'mapping_confidence_asc',
  'mapping_confidence_desc',
] as const;

export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

export interface AdminProductListFilters {
  search?: string;
  mappingStatus?: string;
  isHidden?: 'true' | 'false';
  shopifyCollectionId?: string;
  vendor?: string;
  productType?: string;
  inStock?: 'true' | 'false';
  priceMin?: number;
  priceMax?: number;
  tag?: string;
  sort?: AdminProductSort;
  /** Comma-separated pos_products.id (show-selected-only mode) */
  ids?: string;
}

function parseSort(raw: string | undefined): AdminProductSort | undefined {
  if (!raw) return undefined;
  return (ADMIN_PRODUCT_SORTS as readonly string[]).includes(raw) ? (raw as AdminProductSort) : undefined;
}

export function parseAdminProductFilters(q: Record<string, string | undefined>): AdminProductListFilters {
  const f: AdminProductListFilters = {};
  if (q.search?.trim()) f.search = q.search.trim();
  if (q.mappingStatus?.trim()) f.mappingStatus = q.mappingStatus.trim();
  if (q.isHidden === 'true' || q.isHidden === 'false') f.isHidden = q.isHidden;
  if (q.shopifyCollectionId?.trim()) f.shopifyCollectionId = q.shopifyCollectionId.trim();
  if (q.vendor?.trim()) f.vendor = q.vendor.trim();
  if (q.productType?.trim()) f.productType = q.productType.trim();
  if (q.inStock === 'true' || q.inStock === 'false') f.inStock = q.inStock;
  if (q.tag?.trim()) f.tag = q.tag.trim();
  if (q.ids?.trim()) f.ids = q.ids.trim();
  const pm = q.priceMin?.trim();
  if (pm != null && pm !== '') {
    const n = parseInt(pm, 10);
    if (Number.isFinite(n)) f.priceMin = n;
  }
  const px = q.priceMax?.trim();
  if (px != null && px !== '') {
    const n = parseInt(px, 10);
    if (Number.isFinite(n)) f.priceMax = n;
  }
  const s = parseSort(q.sort);
  if (s) f.sort = s;
  return f;
}

export function filtersForBulkToken(f: AdminProductListFilters): AdminProductListFilters {
  const { ids: _ids, ...rest } = f;
  return rest;
}

export function applyAdminProductFilters(
  qb: Knex.QueryBuilder,
  tenantId: string,
  f: AdminProductListFilters
): void {
  qb.where('pos_products.tenant_id', tenantId);
  if (f.mappingStatus) qb.where('pos_products.mapping_status', f.mappingStatus);
  if (f.isHidden === 'true') qb.where('pos_products.is_hidden', true);
  if (f.isHidden === 'false') qb.where('pos_products.is_hidden', false);
  if (f.vendor?.trim()) qb.where('pos_products.vendor', 'ilike', `%${f.vendor.trim()}%`);
  if (f.productType?.trim()) {
    qb.where('pos_products.product_type', 'ilike', `%${f.productType.trim()}%`);
  }
  if (f.inStock === 'true') qb.where('pos_products.inventory_quantity', '>', 0);
  if (f.inStock === 'false') qb.where('pos_products.inventory_quantity', '<=', 0);
  if (typeof f.priceMin === 'number') qb.where('pos_products.price', '>=', f.priceMin);
  if (typeof f.priceMax === 'number') qb.where('pos_products.price', '<=', f.priceMax);
  if (f.tag?.trim()) {
    qb.whereRaw('? = ANY(pos_products.tags)', [f.tag.trim()]);
  }
  if (f.shopifyCollectionId?.trim()) {
    qb.whereExists(function whereColl(this: Knex.QueryBuilder) {
      this.select(1)
        .from('pos_product_shopify_collections as psc')
        .whereRaw('psc.pos_product_id = pos_products.id')
        .andWhere('psc.shopify_collection_id', f.shopifyCollectionId!.trim());
    });
  }
  if (f.search?.trim()) {
    const s = `%${f.search.trim()}%`;
    qb.andWhere((b: Knex.QueryBuilder) => {
      b.where('pos_products.title', 'ilike', s)
        .orWhere('pos_products.sku', 'ilike', s)
        .orWhere('pos_products.barcode', 'ilike', s)
        .orWhere('pos_products.vendor', 'ilike', s)
        .orWhere('pos_products.product_type', 'ilike', s)
        .orWhereRaw(
          `exists (select 1 from unnest(coalesce(pos_products.tags, array[]::text[])) as t(tag) where t.tag ilike ?)`,
          [s]
        );
    });
  }
  if (f.ids?.trim()) {
    const idList = f.ids
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (idList.length) qb.whereIn('pos_products.id', idList);
  }
}

export function applyAdminProductSort(qb: Knex.QueryBuilder, sort: AdminProductSort | undefined): void {
  const s = sort || 'updated_at_desc';
  switch (s) {
    case 'updated_at_asc':
      qb.orderBy('pos_products.updated_at', 'asc');
      break;
    case 'title_asc':
      qb.orderBy('pos_products.title', 'asc');
      break;
    case 'title_desc':
      qb.orderBy('pos_products.title', 'desc');
      break;
    case 'price_asc':
      qb.orderBy('pos_products.price', 'asc');
      break;
    case 'price_desc':
      qb.orderBy('pos_products.price', 'desc');
      break;
    case 'inventory_asc':
      qb.orderBy('pos_products.inventory_quantity', 'asc');
      break;
    case 'inventory_desc':
      qb.orderBy('pos_products.inventory_quantity', 'desc');
      break;
    case 'is_hidden_asc':
      qb.orderBy('pos_products.is_hidden', 'asc');
      break;
    case 'is_hidden_desc':
      qb.orderBy('pos_products.is_hidden', 'desc');
      break;
    case 'mapping_status_asc':
      qb.orderBy('pos_products.mapping_status', 'asc');
      break;
    case 'mapping_status_desc':
      qb.orderBy('pos_products.mapping_status', 'desc');
      break;
    case 'mapping_confidence_asc':
      qb.orderByRaw('pos_products.mapping_confidence ASC NULLS LAST');
      break;
    case 'mapping_confidence_desc':
      qb.orderByRaw('pos_products.mapping_confidence DESC NULLS LAST');
      break;
    default:
      qb.orderBy('pos_products.updated_at', 'desc');
  }
}
