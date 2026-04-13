import api from './api';

export type ShopCompatibility = 'compatible' | 'other_model' | 'general' | 'needs_spa';

export type ShopProductRow = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  sku?: string | null;
  barcode?: string | null;
  images?: unknown;
  inventory_quantity: number;
  product_type?: string | null;
  shop_compatibility: ShopCompatibility;
  category_id?: string | null;
  category_name?: string | null;
  subscription_eligible?: boolean;
};

export type ShopCategory =
  | { kind: 'uhtd'; id: string; displayName: string; sortOrder: number | null }
  | { kind: 'product_type'; key: string; displayName: string };

export function categoryKeyForUhtdCategory(id: string): string {
  return `uhtd:${id}`;
}

export function categoryKeyForProductType(key: string): string {
  return `ptype:${encodeURIComponent(key)}`;
}

export type ShopListParams = {
  spaProfileId?: string;
  includeOtherSpaParts: boolean;
  includeGeneralStore: boolean;
  hideOutOfStock: boolean;
  /** Whole USD cents, inclusive (API `priceMin`) */
  priceMin?: number;
  /** Whole USD cents, inclusive (API `priceMax`) */
  priceMax?: number;
  page: number;
  pageSize: number;
  search?: string;
  categoryKey?: string | null;
};

export async function fetchShopProducts(params: ShopListParams) {
  const res = (await api.get('/products/shop', {
    params: {
      spaProfileId: params.spaProfileId,
      includeOtherSpaParts: params.includeOtherSpaParts,
      includeGeneralStore: params.includeGeneralStore,
      hideOutOfStock: params.hideOutOfStock,
      ...(typeof params.priceMin === 'number' ? { priceMin: params.priceMin } : {}),
      ...(typeof params.priceMax === 'number' ? { priceMax: params.priceMax } : {}),
      page: params.page,
      pageSize: params.pageSize,
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      ...(params.categoryKey ? { categoryKey: params.categoryKey } : {}),
    },
  })) as {
    success?: boolean;
    data?: ShopProductRow[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  };
  return res;
}

export async function fetchShopPriceBounds(params: {
  spaProfileId?: string;
  includeOtherSpaParts: boolean;
  includeGeneralStore: boolean;
  hideOutOfStock: boolean;
  categoryKey?: string | null;
  search?: string;
}) {
  const res = (await api.get('/products/shop/price-bounds', {
    params: {
      spaProfileId: params.spaProfileId,
      includeOtherSpaParts: params.includeOtherSpaParts,
      includeGeneralStore: params.includeGeneralStore,
      hideOutOfStock: params.hideOutOfStock,
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      ...(params.categoryKey ? { categoryKey: params.categoryKey } : {}),
    },
  })) as { success?: boolean; data?: { minCents: number | null; maxCents: number | null } };
  return res;
}

export async function fetchShopCategories(params: {
  spaProfileId?: string;
  includeOtherSpaParts: boolean;
  includeGeneralStore: boolean;
  hideOutOfStock: boolean;
  priceMin?: number;
  priceMax?: number;
}) {
  const res = (await api.get('/products/shop/categories', {
    params: {
      spaProfileId: params.spaProfileId,
      includeOtherSpaParts: params.includeOtherSpaParts,
      includeGeneralStore: params.includeGeneralStore,
      hideOutOfStock: params.hideOutOfStock,
      ...(typeof params.priceMin === 'number' ? { priceMin: params.priceMin } : {}),
      ...(typeof params.priceMax === 'number' ? { priceMax: params.priceMax } : {}),
    },
  })) as { success?: boolean; data?: ShopCategory[] };
  return res;
}

export type ProductVariantRow = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  inventory_quantity: number;
  storefrontVariantGid: string | null;
  isSelected: boolean;
};

export type ProductDetail = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  compare_at_price?: number | null;
  images?: unknown;
  inventory_quantity: number;
  product_type?: string | null;
  shopCompatibility?: ShopCompatibility;
  variants?: ProductVariantRow[];
  subscription_eligible?: boolean;
  [key: string]: unknown;
};

export async function fetchProductDetail(productId: string, spaProfileId?: string) {
  const res = (await api.get(`/products/${productId}`, {
    params: spaProfileId ? { spaProfileId } : undefined,
  })) as { success?: boolean; data?: ProductDetail };
  return res;
}

export async function fetchShopRelatedProducts(
  productId: string,
  params: {
    spaProfileId?: string;
    limit?: number;
    includeOtherSpaParts: boolean;
    includeGeneralStore: boolean;
    hideOutOfStock: boolean;
  }
) {
  const res = (await api.get(`/products/shop/${productId}/related`, {
    params: {
      spaProfileId: params.spaProfileId,
      limit: params.limit ?? 6,
      includeOtherSpaParts: params.includeOtherSpaParts,
      includeGeneralStore: params.includeGeneralStore,
      hideOutOfStock: params.hideOutOfStock,
    },
  })) as { success?: boolean; data?: ShopProductRow[] };
  return res;
}
