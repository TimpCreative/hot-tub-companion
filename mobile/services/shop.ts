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

export async function fetchShopCategories(params: {
  spaProfileId?: string;
  includeOtherSpaParts: boolean;
  includeGeneralStore: boolean;
}) {
  const res = (await api.get('/products/shop/categories', {
    params: {
      spaProfileId: params.spaProfileId,
      includeOtherSpaParts: params.includeOtherSpaParts,
      includeGeneralStore: params.includeGeneralStore,
    },
  })) as { success?: boolean; data?: ShopCategory[] };
  return res;
}

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
  [key: string]: unknown;
};

export async function fetchProductDetail(productId: string, spaProfileId?: string) {
  const res = (await api.get(`/products/${productId}`, {
    params: spaProfileId ? { spaProfileId } : undefined,
  })) as { success?: boolean; data?: ProductDetail };
  return res;
}
