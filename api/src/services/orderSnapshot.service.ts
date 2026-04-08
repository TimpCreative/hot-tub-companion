/**
 * Denormalized Shopify order payloads for customer order history (no live Shopify reads on list/detail).
 */

export const ORDER_SNAPSHOT_VERSION = 1 as const;

export type OrderSnapshotLineItemV1 = {
  title: string;
  variantTitle: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
  imageUrl: string | null;
};

export type OrderSnapshotV1 = {
  v: typeof ORDER_SNAPSHOT_VERSION;
  lineItems: OrderSnapshotLineItemV1[];
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

export type OrderSnapshotColumns = {
  snapshot: OrderSnapshotV1;
  orderedAt: Date | null;
  currency: string | null;
  totalCents: number | null;
  financialStatus: string | null;
};

function moneyToCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }
  return 0;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function parseLineItems(raw: unknown): OrderSnapshotLineItemV1[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderSnapshotLineItemV1[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const qty = Number(o.quantity);
    const quantity = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
    if (quantity <= 0) continue;
    const title = str(o.title) || str(o.name) || 'Item';
    const variantTitle = str(o.variant_title);
    const unitPriceCents = moneyToCents(o.price);
    const lineTotalCents =
      typeof o.line_price === 'string' || typeof o.line_price === 'number'
        ? moneyToCents(o.line_price)
        : unitPriceCents * quantity;
    const sku = str(o.sku);
    let imageUrl: string | null = null;
    if (o.image && typeof o.image === 'object' && o.image !== null) {
      const img = o.image as Record<string, unknown>;
      imageUrl = str(img.src) || str(img.url);
    }
    out.push({
      title,
      variantTitle,
      quantity,
      unitPriceCents,
      lineTotalCents,
      sku,
      imageUrl,
    });
  }
  return out;
}

function shippingCentsFromOrder(o: Record<string, unknown>): number {
  const lines = o.shipping_lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    return moneyToCents(o.total_shipping_price_set ?? o.total_shipping);
  }
  let sum = 0;
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const sl = line as Record<string, unknown>;
    const discounted = sl.discounted_price;
    const price = sl.price;
    sum += moneyToCents(discounted ?? price);
  }
  return sum;
}

function shippingSummaryFromOrder(o: Record<string, unknown>): string | null {
  const addr = o.shipping_address;
  if (!addr || typeof addr !== 'object') return null;
  const a = addr as Record<string, unknown>;
  const parts = [
    str(a.address1),
    str(a.city),
    str(a.province) || str(a.province_code),
    str(a.zip),
    str(a.country) || str(a.country_code),
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : null;
}

/**
 * Build snapshot + index columns from Shopify Admin REST order JSON (webhook or GET /orders/:id.json).
 */
export function buildOrderSnapshotFromShopifyOrder(payload: unknown): OrderSnapshotColumns | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;

  const lineItems = parseLineItems(o.line_items);
  const currency = str(o.currency) || str(o.presentment_currency) || 'USD';
  const subtotalCents = moneyToCents(o.subtotal_price);
  const taxCents = moneyToCents(o.total_tax);
  const shippingCents = shippingCentsFromOrder(o);
  const totalCents = moneyToCents(o.total_price);
  const financialStatus = str(o.financial_status);
  const confirmationNumber = str(o.confirmation_number) || str(o.name);
  const shippingSummary = shippingSummaryFromOrder(o);

  let orderedAt: Date | null = null;
  const created = o.created_at;
  if (typeof created === 'string') {
    const d = new Date(created);
    if (!Number.isNaN(d.getTime())) orderedAt = d;
  }

  const firstLineTitle = lineItems.length > 0 ? lineItems[0].title : null;

  const snapshot: OrderSnapshotV1 = {
    v: ORDER_SNAPSHOT_VERSION,
    lineItems,
    subtotalCents,
    shippingCents,
    taxCents,
    totalCents,
    currency,
    shippingSummary,
    confirmationNumber,
    firstLineTitle,
    lineItemCount: lineItems.length,
  };

  return {
    snapshot,
    orderedAt,
    currency,
    totalCents,
    financialStatus,
  };
}
