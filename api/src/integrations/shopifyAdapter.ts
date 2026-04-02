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

interface ShopifyProduct {
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

async function fetchProductsPage(
  tenantId: string,
  options?: PosSyncOptions
): Promise<ShopifyProduct[]> {
  const searchParams = new URLSearchParams();
  searchParams.set('limit', '250');

  if (options?.since) {
    // Shopify uses ISO 8601 timestamps for updated_at_min
    searchParams.set('updated_at_min', options.since.toISOString());
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

  const data = (await res.json()) as ShopifyProductsResponse;
  return data.products || [];
}

async function syncCatalogInternal(
  tenantId: string,
  options?: PosSyncOptions
): Promise<PosSyncSummary> {
  const errors: PosSyncError[] = [];
  let created = 0;
  let updated = 0;
  let deletedOrArchived = 0;

  // For Phase 1, we keep the implementation intentionally simple:
  // - Single-page fetch up to 250 products
  // - No deep pagination yet
  const products = await fetchProductsPage(tenantId, options);

  for (const product of products) {
    for (const variant of product.variants) {
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
  }

  // In a future iteration we can reconcile removed/archived products here
  // and increment deletedOrArchived accordingly.

  return {
    created,
    updated,
    deletedOrArchived,
    errors,
  };
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

