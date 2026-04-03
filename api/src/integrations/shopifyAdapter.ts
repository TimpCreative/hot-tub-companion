import { db } from '../config/database';
import { env } from '../config/environment';
import {
  fetchTenantShopDomainFromShopify,
  getTenantShopifyAdminAccessToken,
  ShopifyAuthError,
} from '../services/shopifyAuth.service';
import type {
  DbPosProduct,
  PosAdapter,
  PosSyncOptions,
  PosSyncSummary,
  PosSyncError,
} from '../types/uhtd.types';

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string;
  status?: string;
  variants: Array<{
    id: number;
    title: string;
    sku: string | null;
    barcode: string | null;
    price: string;
    compare_at_price: string | null;
    inventory_quantity?: number;
    inventory_item_id?: number;
    updated_at?: string;
    weight?: number;
    weight_unit?: string;
  }>;
  images: Array<{
    id: number;
    src: string;
    position?: number;
  }>;
  updated_at?: string;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

interface ShopifyProductCountResponse {
  count?: number;
}

interface ShopifyCollect {
  id: number;
  collection_id: number;
  product_id: number;
}

interface ShopifyCollectsResponse {
  collects?: ShopifyCollect[];
}

interface ShopifyCustomCollection {
  id: number;
  handle: string | null;
  title: string | null;
  updated_at?: string;
}

interface ShopifySmartCollection {
  id: number;
  handle: string | null;
  title: string | null;
  updated_at?: string;
}

export const SHOPIFY_PRODUCTS_PAGE_LIMIT = 250;

/** Safety cap: ~6.25M products before we stop (unlikely; avoids infinite loops). */
const SHOPIFY_SYNC_MAX_PAGES = 25000;

function getShopifyBaseUrl(storeUrl: string): string {
  const trimmed = storeUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

async function shopifyFetch(
  tenantId: string,
  path: string
): Promise<Response> {
  const tokenResult = await getTenantShopifyAdminAccessToken(tenantId);
  const baseUrl = getShopifyBaseUrl(tokenResult.shopDomain);
  const url = `${baseUrl}/admin/api/2025-01${path}`;

  let res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': tokenResult.accessToken,
      'Content-Type': 'application/json',
    },
  });

  // Retry once with a forced refresh if the token-exchange path returns stale credentials.
  if ((res.status === 401 || res.status === 403) && tokenResult.source === 'client_credentials') {
    const refreshed = await getTenantShopifyAdminAccessToken(tenantId, { forceRefresh: true });
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': refreshed.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  return res;
}

/**
 * Authenticated Admin API request (GET/POST/DELETE) with JSON body when provided.
 */
export async function shopifyAdminJson(
  tenantId: string,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const tokenResult = await getTenantShopifyAdminAccessToken(tenantId);
  const baseUrl = getShopifyBaseUrl(tokenResult.shopDomain);
  const url = `${baseUrl}/admin/api/2025-01${path}`;

  const init: RequestInit = {
    method,
    headers: {
      'X-Shopify-Access-Token': tokenResult.accessToken,
      'Content-Type': 'application/json',
    },
  };
  if (body != null && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  let res = await fetch(url, init);
  if ((res.status === 401 || res.status === 403) && tokenResult.source === 'client_credentials') {
    const refreshed = await getTenantShopifyAdminAccessToken(tenantId, { forceRefresh: true });
    res = await fetch(url, {
      ...init,
      headers: {
        'X-Shopify-Access-Token': refreshed.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }
  return res;
}

/**
 * Parse Shopify REST Link header for cursor pagination (rel="next").
 */
export function parseNextPageInfoFromLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const rawPart of linkHeader.split(',')) {
    const part = rawPart.trim();
    const m = part.match(/^<([^>]+)>;\s*rel="next"/);
    if (!m) continue;
    try {
      const url = new URL(m[1]);
      return url.searchParams.get('page_info');
    } catch {
      continue;
    }
  }
  return null;
}

function parseTags(tags: string | null): string[] | null {
  if (!tags) return null;
  const parts = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

function parseMoney(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function upsertVariantRow(
  tenantId: string,
  product: ShopifyProduct,
  variant: ShopifyProduct['variants'][number]
): Promise<void> {
  const now = new Date();

  const title = product.title || '';
  const description = product.body_html || null;
  const vendor = product.vendor || null;
  const productType = product.product_type || null;
  const tags = parseTags(product.tags || null);
  const price = parseMoney(variant.price) ?? 0;
  const compareAtPrice = parseMoney(variant.compare_at_price);
  const sku = variant.sku || null;
  const barcode = variant.barcode || null;
  const images = product.images?.map((img) => img.src) ?? [];
  const variants = product.variants ?? [];
  const inventoryQuantity = typeof variant.inventory_quantity === 'number'
    ? variant.inventory_quantity
    : 0;
  const weight = typeof variant.weight === 'number' ? variant.weight : null;
  const weightUnit = variant.weight_unit || null;
  const posStatus = product.status || null;
  const posUpdatedAt =
    parseDate(variant.updated_at || product.updated_at || null);
  const shopifyInventoryItemId =
    typeof variant.inventory_item_id === 'number' && Number.isFinite(variant.inventory_item_id)
      ? String(variant.inventory_item_id)
      : null;

  // Use tenant_id + pos_product_id + pos_variant_id as uniqueness key
  const existing: DbPosProduct | undefined = await db<DbPosProduct>('pos_products')
    .where({
      tenant_id: tenantId,
      pos_product_id: String(product.id),
      pos_variant_id: String(variant.id),
    })
    .first();

  const baseData = {
    tenant_id: tenantId,
    pos_product_id: String(product.id),
    pos_variant_id: String(variant.id),
    title,
    description,
    vendor,
    product_type: productType,
    tags,
    price,
    compare_at_price: compareAtPrice,
    sku,
    barcode,
    // Serialize explicitly for Postgres json/jsonb columns. Passing raw JS arrays
    // can be interpreted as SQL array text by the driver and fail with
    // "invalid input syntax for type json".
    images: JSON.stringify(images),
    variants: JSON.stringify(variants),
    inventory_quantity: inventoryQuantity,
    weight,
    weight_unit: weightUnit,
    pos_status: posStatus,
    pos_updated_at: posUpdatedAt,
    last_synced_at: now,
    shopify_inventory_item_id: shopifyInventoryItemId,
  };

  if (existing) {
    await db('pos_products')
      .where({ id: existing.id })
      .update({
        ...baseData,
        updated_at: now,
      });
  } else {
    await db('pos_products').insert({
      ...baseData,
      is_hidden: false,
      hidden_at: null,
      hidden_by: null,
      uhtd_part_id: null,
      mapping_status: 'unmapped',
      mapping_confidence: null,
      mapped_by: null,
      mapped_at: null,
      sync_hash: null,
      created_at: now,
      updated_at: now,
    });
  }
}

/**
 * Paginate Shopify collects for a product (REST).
 */
async function fetchCollectsForProduct(
  tenantId: string,
  productId: number
): Promise<number[]> {
  const collectionIds: number[] = [];
  let pageInfo: string | null = null;
  let guard = 0;
  while (guard < 100) {
    guard += 1;
    const searchParams = new URLSearchParams();
    searchParams.set('limit', '250');
    if (pageInfo) {
      searchParams.set('page_info', pageInfo);
    } else {
      searchParams.set('product_id', String(productId));
    }

    const res = await shopifyFetch(tenantId, `/collects.json?${searchParams.toString()}`);
    if (res.status === 401 || res.status === 403) {
      const text = await res.text();
      throw new Error(`Shopify auth failed (${res.status}): ${text}`);
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify collects error (${res.status}): ${text}`);
    }
    const data = (await res.json()) as ShopifyCollectsResponse;
    for (const row of data.collects || []) {
      if (typeof row.collection_id === 'number') collectionIds.push(row.collection_id);
    }
    pageInfo = parseNextPageInfoFromLink(res.headers.get('link'));
    if (!pageInfo) break;
  }
  return collectionIds;
}

async function upsertShopifyCollectionRow(
  tenantId: string,
  collectionIdNum: number
): Promise<void> {
  const idStr = String(collectionIdNum);
  let collType: 'custom' | 'smart' = 'custom';
  let res = await shopifyFetch(tenantId, `/custom_collections/${collectionIdNum}.json`);
  if (!res.ok) {
    collType = 'smart';
    res = await shopifyFetch(tenantId, `/smart_collections/${collectionIdNum}.json`);
  }
  const now = new Date();
  if (!res.ok) {
    await db('pos_shopify_collections')
      .insert({
        tenant_id: tenantId,
        shopify_collection_id: idStr,
        collection_type: 'custom',
        handle: null,
        title: `Collection ${idStr}`,
        shopify_updated_at: null,
        raw: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['tenant_id', 'shopify_collection_id'])
      .merge({
        updated_at: now,
      });
    return;
  }
  const body = (await res.json()) as {
    custom_collection?: ShopifyCustomCollection;
    smart_collection?: ShopifySmartCollection;
  };
  const c =
    collType === 'custom' ? body.custom_collection : body.smart_collection;
  if (!c || typeof c.id !== 'number') return;

  await db('pos_shopify_collections')
    .insert({
      tenant_id: tenantId,
      shopify_collection_id: idStr,
      collection_type: collType,
      handle: c.handle ?? null,
      title: c.title ?? null,
      shopify_updated_at: parseDate(c.updated_at),
      raw: null,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['tenant_id', 'shopify_collection_id'])
    .merge({
      collection_type: collType,
      handle: c.handle ?? null,
      title: c.title ?? null,
      shopify_updated_at: parseDate(c.updated_at),
      updated_at: now,
    });
}

/**
 * Replace collection membership for all pos_products rows belonging to this Shopify product.
 * Call after variants are upserted.
 */
export async function syncShopifyCollectionsForProduct(
  tenantId: string,
  shopifyProductId: number
): Promise<void> {
  const posProductIdStr = String(shopifyProductId);
  const variantRows = await db('pos_products')
    .where({ tenant_id: tenantId, pos_product_id: posProductIdStr })
    .select('id');
  if (!variantRows.length) return;

  const collectionIds = await fetchCollectsForProduct(tenantId, shopifyProductId);
  const collIdStrings = [...new Set(collectionIds.map(String))];

  for (const cid of collectionIds) {
    await upsertShopifyCollectionRow(tenantId, cid);
  }

  const posIds = variantRows.map((r: { id: string }) => r.id);

  await db.transaction(async (trx) => {
    await trx('pos_product_shopify_collections').whereIn('pos_product_id', posIds).delete();
    const rows: Array<{
      tenant_id: string;
      pos_product_id: string;
      shopify_collection_id: string;
    }> = [];
    for (const pid of posIds) {
      for (const cid of collIdStrings) {
        rows.push({
          tenant_id: tenantId,
          pos_product_id: pid,
          shopify_collection_id: cid,
        });
      }
    }
    if (rows.length) {
      await trx('pos_product_shopify_collections').insert(rows);
    }
  });
}

async function fetchProductsPageWithCursor(
  tenantId: string,
  params: { pageInfo?: string | null; updatedAtMin?: Date }
): Promise<{ products: ShopifyProduct[]; nextPageInfo: string | null }> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(SHOPIFY_PRODUCTS_PAGE_LIMIT));

  if (params.pageInfo) {
    searchParams.set('page_info', params.pageInfo);
  } else if (params.updatedAtMin) {
    searchParams.set('updated_at_min', params.updatedAtMin.toISOString());
  }

  const res = await shopifyFetch(tenantId, `/products.json?${searchParams.toString()}`);

  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    throw new Error(`Shopify auth failed (${res.status}): ${text}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error (${res.status}): ${text}`);
  }

  const link = res.headers.get('link');
  const nextPageInfo = parseNextPageInfoFromLink(link);
  const data = (await res.json()) as ShopifyProductsResponse;
  return { products: data.products || [], nextPageInfo };
}

/**
 * Total product count for progress estimates (Shopify Products REST).
 */
export async function fetchShopifyProductCount(tenantId: string): Promise<number> {
  const res = await shopifyFetch(tenantId, '/products/count.json');
  if (res.status === 401 || res.status === 403) {
    const text = await res.text();
    throw new Error(`Shopify auth failed (${res.status}): ${text}`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error (${res.status}): ${text}`);
  }
  const body = (await res.json()) as ShopifyProductCountResponse;
  return typeof body.count === 'number' && Number.isFinite(body.count) ? body.count : 0;
}

export async function getShopifyCatalogSyncEstimate(tenantId: string): Promise<{
  totalProducts: number;
  pageSize: number;
  estimatedPages: number;
}> {
  const totalProducts = await fetchShopifyProductCount(tenantId);
  const pageSize = SHOPIFY_PRODUCTS_PAGE_LIMIT;
  const estimatedPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  return { totalProducts, pageSize, estimatedPages };
}

/**
 * Upsert all variants from Shopify product payloads into pos_products (sync + webhooks).
 */
export async function applyShopifyProductsToPosProducts(
  tenantId: string,
  products: ShopifyProduct[]
): Promise<PosSyncSummary> {
  const errors: PosSyncError[] = [];
  let created = 0;
  let updated = 0;
  const deletedOrArchived = 0;

  for (const product of products) {
    for (const variant of product.variants || []) {
      try {
        const before = await db('pos_products')
          .where({
            tenant_id: tenantId,
            pos_product_id: String(product.id),
            pos_variant_id: String(variant.id),
          })
          .first();

        await upsertVariantRow(tenantId, product, variant);

        if (before) {
          updated += 1;
        } else {
          created += 1;
        }
      } catch (err: any) {
        errors.push({
          id: `${product.id}:${variant.id}`,
          message: err?.message || 'Unknown error syncing variant',
        });
      }
    }
    try {
      if (typeof product.id === 'number') {
        await syncShopifyCollectionsForProduct(tenantId, product.id);
      }
    } catch (err: any) {
      errors.push({
        id: String(product.id),
        message: err?.message || 'Unknown error syncing collections for product',
      });
    }
  }

  return {
    created,
    updated,
    deletedOrArchived,
    errors,
  };
}

export type ShopifyCatalogSyncMode = 'full' | 'incremental';

/**
 * Sync a single Shopify products page (for batched / interactive imports).
 * When pageInfo is set, only the cursor is used (Shopify REST rules).
 */
export async function syncShopifyCatalogPage(
  tenantId: string,
  input: {
    pageInfo?: string | null;
    mode: ShopifyCatalogSyncMode;
    /** Used only for the first page of an incremental sync (when pageInfo is null). */
    since?: Date;
  }
): Promise<
  PosSyncSummary & {
    nextPageInfo: string | null;
    productsInPage: number;
  }
> {
  const pageInfo = input.pageInfo ?? null;
  let updatedAtMin: Date | undefined;
  if (!pageInfo) {
    if (input.mode === 'incremental' && input.since) {
      updatedAtMin = input.since;
    }
  }

  const { products, nextPageInfo } = await fetchProductsPageWithCursor(tenantId, {
    pageInfo,
    updatedAtMin,
  });

  const summary = await applyShopifyProductsToPosProducts(tenantId, products);
  return {
    ...summary,
    nextPageInfo,
    productsInPage: products.length,
  };
}

async function syncCatalogInternal(
  tenantId: string,
  options?: PosSyncOptions
): Promise<PosSyncSummary> {
  const aggregated: PosSyncSummary = {
    created: 0,
    updated: 0,
    deletedOrArchived: 0,
    errors: [],
  };

  let pageInfo: string | null = null;
  let pages = 0;

  while (pages < SHOPIFY_SYNC_MAX_PAGES) {
    const useIncrementalFirstPage =
      !options?.full &&
      !pageInfo &&
      !!options?.since;

    const { products, nextPageInfo } = await fetchProductsPageWithCursor(tenantId, {
      pageInfo,
      updatedAtMin: useIncrementalFirstPage ? options!.since : undefined,
    });

    const pageSummary = await applyShopifyProductsToPosProducts(tenantId, products);
    aggregated.created += pageSummary.created;
    aggregated.updated += pageSummary.updated;
    aggregated.deletedOrArchived += pageSummary.deletedOrArchived;
    aggregated.errors.push(...pageSummary.errors);

    pageInfo = nextPageInfo;
    pages += 1;
    if (!pageInfo) break;
  }

  if (pages >= SHOPIFY_SYNC_MAX_PAGES && pageInfo) {
    aggregated.errors.push({
      message:
        `Shopify sync stopped after ${SHOPIFY_SYNC_MAX_PAGES} pages to avoid an infinite loop; more catalog pages remain.`,
    });
  }

  return aggregated;
}

export const shopifyAdapter: PosAdapter = {
  async testConnection(tenantId: string) {
    try {
      const shopDomainCheck = await fetchTenantShopDomainFromShopify(tenantId);
      if (shopDomainCheck.configuredShopDomain !== shopDomainCheck.returnedShopDomain) {
        return {
          ok: false,
          message: `Shop domain mismatch: configured ${shopDomainCheck.configuredShopDomain}, Shopify returned ${shopDomainCheck.returnedShopDomain}`,
          details: {
            code: 'DOMAIN_MISMATCH',
            configuredShopDomain: shopDomainCheck.configuredShopDomain,
            returnedShopDomain: shopDomainCheck.returnedShopDomain,
            authSource: shopDomainCheck.authSource,
          },
        };
      }

      const res = await shopifyFetch(tenantId, '/products.json?limit=1');
      if (res.status === 401 || res.status === 403) {
        const text = await res.text();
        return {
          ok: false,
          message: `Shopify auth failed (${res.status}): ${text}`,
          details: { code: 'AUTH_ERROR' },
        };
      }
      if (!res.ok) {
        const text = await res.text();
        return {
          ok: false,
          message: `Shopify API error (${res.status}): ${text}`,
          details: { code: 'API_ERROR' },
        };
      }
      return {
        ok: true,
        details: {
          code: 'OK',
          shopDomain: shopDomainCheck.returnedShopDomain,
          authSource: shopDomainCheck.authSource,
        },
      };
    } catch (err: any) {
      if (err instanceof ShopifyAuthError) {
        return {
          ok: false,
          message: err.message,
          details: { code: err.code },
        };
      }
      return {
        ok: false,
        message: err?.message || 'Unknown error testing Shopify connection',
        details: { code: 'INTERNAL_ERROR' },
      };
    }
  },

  async syncCatalog(tenantId: string, options?: PosSyncOptions): Promise<PosSyncSummary> {
    // For now we ignore env-level feature flags; this can be extended later.
    if (!env.DATABASE_URL) {
      throw new Error('Database is not configured');
    }
    return syncCatalogInternal(tenantId, options);
  },
};

