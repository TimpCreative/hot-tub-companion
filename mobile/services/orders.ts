import api from './api';

export type OrderSnapshotLineItem = {
  title: string;
  variantTitle: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
  imageUrl: string | null;
};

export type OrderSnapshot = {
  v: number;
  lineItems: OrderSnapshotLineItem[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingSummary: string | null;
  confirmationNumber: string | null;
  firstLineTitle: string | null;
  lineItemCount: number;
};

export type OrderListItem = {
  id: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  createdAt: string;
  orderedAt: string | null;
  currency: string | null;
  totalCents: number | null;
  financialStatus: string | null;
  firstLineTitle: string | null;
  lineItemCount: number;
  hasSnapshot: boolean;
};

export type OrderDetail = OrderListItem & {
  snapshot: OrderSnapshot | null;
  customerEmail: string | null;
};

type ListEnvelope = {
  success?: boolean;
  data?: {
    orders: OrderListItem[];
    pagination?: { page: number; pageSize: number; total: number; totalPages: number };
  };
};

type DetailEnvelope = {
  success?: boolean;
  data?: OrderDetail;
};

export function formatOrderMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents == null || !Number.isFinite(Number(cents))) return '—';
  const cur = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(Number(cents) / 100);
  } catch {
    return `${(Number(cents) / 100).toFixed(2)} ${cur}`;
  }
}

export function orderTitle(o: Pick<OrderListItem, 'shopifyOrderNumber' | 'shopifyOrderId'>): string {
  if (o.shopifyOrderNumber != null) return `Order #${o.shopifyOrderNumber}`;
  return `Order ${o.shopifyOrderId}`;
}

export type OrdersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export async function fetchMyOrders(
  page = 1,
  pageSize = 20,
): Promise<{ orders: OrderListItem[]; pagination: OrdersPagination }> {
  const raw = (await api.get(`/orders?page=${page}&pageSize=${pageSize}`)) as ListEnvelope;
  if (!raw?.success || !raw.data) {
    return { orders: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0 } };
  }
  return {
    orders: raw.data.orders ?? [],
    pagination: raw.data.pagination ?? { page: 1, pageSize, total: 0, totalPages: 0 },
  };
}

export async function fetchMyOrderById(referenceId: string): Promise<OrderDetail | null> {
  const raw = (await api.get(`/orders/${encodeURIComponent(referenceId)}`)) as DetailEnvelope;
  if (!raw?.success || !raw.data) return null;
  return raw.data;
}

export type SyncOrdersResult = {
  claimedRows: number;
  fetchedFromShopify: number;
  upserted: number;
  snapshotsWritten: number;
  errors: number;
};

type SyncEnvelope = {
  success?: boolean;
  data?: SyncOrdersResult;
  error?: { message?: string; code?: string };
};

export async function syncMyOrdersFromShopify(): Promise<SyncOrdersResult> {
  const raw = (await api.post('/orders/sync', {})) as SyncEnvelope;
  if (!raw?.success || raw.data === undefined) {
    const msg = raw?.error?.message || 'Sync failed';
    throw new Error(msg);
  }
  return raw.data;
}
