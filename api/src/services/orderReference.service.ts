import { db } from '../config/database';

export type UpsertOrderReferenceInput = {
  tenantId: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  userId: string | null;
  customerEmail: string | null;
};

export type OrderReferenceRow = {
  id: string;
  tenantId: string;
  shopifyOrderId: string;
  shopifyOrderNumber: number | null;
  userId: string | null;
  customerEmail: string | null;
  createdAt: Date;
};

function mapOrderReferenceRow(row: Record<string, unknown>): OrderReferenceRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    shopifyOrderId: String(row.shopify_order_id),
    shopifyOrderNumber:
      row.shopify_order_number === null || row.shopify_order_number === undefined
        ? null
        : Number(row.shopify_order_number),
    userId: row.user_id ? String(row.user_id) : null,
    customerEmail: row.customer_email ? String(row.customer_email) : null,
    createdAt: row.created_at as Date,
  };
}

/**
 * Insert or update a row keyed by (tenant_id, shopify_order_id).
 */
export async function upsertOrderReference(input: UpsertOrderReferenceInput): Promise<void> {
  const {
    tenantId,
    shopifyOrderId,
    shopifyOrderNumber,
    userId,
    customerEmail,
  } = input;
  await db('order_references')
    .insert({
      tenant_id: tenantId,
      shopify_order_id: shopifyOrderId,
      shopify_order_number: shopifyOrderNumber,
      user_id: userId,
      customer_email: customerEmail,
    })
    .onConflict(['tenant_id', 'shopify_order_id'])
    .merge(['shopify_order_number', 'user_id', 'customer_email']);
}

const MAX_ORDER_LIST_PAGE_SIZE = 50;

export async function listOrderReferencesForUser(
  tenantId: string,
  userId: string,
  page: number,
  pageSize: number
): Promise<{ rows: OrderReferenceRow[]; total: number }> {
  const p = Math.max(1, page);
  const ps = Math.min(MAX_ORDER_LIST_PAGE_SIZE, Math.max(1, pageSize));
  const offset = (p - 1) * ps;

  const base = db('order_references')
    .where({ tenant_id: tenantId, user_id: userId })
    .whereNotNull('user_id');

  const countRow = await base.clone().count('* as c').first();
  const total = parseInt(String((countRow as { c?: string })?.c ?? '0'), 10);

  const rawRows = await base
    .clone()
    .select('*')
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(ps);

  return {
    rows: rawRows.map((r) => mapOrderReferenceRow(r as Record<string, unknown>)),
    total,
  };
}

export async function getOrderReferenceForUser(
  tenantId: string,
  userId: string,
  shopifyOrderId: string
): Promise<OrderReferenceRow | null> {
  const row = await db('order_references')
    .where({
      tenant_id: tenantId,
      user_id: userId,
      shopify_order_id: shopifyOrderId,
    })
    .first();
  if (!row) return null;
  return mapOrderReferenceRow(row as Record<string, unknown>);
}
