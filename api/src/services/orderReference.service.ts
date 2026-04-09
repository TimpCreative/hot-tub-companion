import { db } from '../config/database';
import {
  fetchShopifyAdminOrderJson,
  fetchShopifyAdminOrdersByCustomerEmail,
} from '../integrations/shopifyAdapter';
import type { OrderSnapshotV1 } from './orderSnapshot.service';
import { buildOrderSnapshotFromShopifyOrder } from './orderSnapshot.service';

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
  snapshot: OrderSnapshotV1 | null;
  orderedAt: Date | null;
  currency: string | null;
  totalCents: number | null;
  financialStatus: string | null;
};

function parseSnapshotFromDb(raw: unknown): OrderSnapshotV1 | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || !Array.isArray(o.lineItems)) return null;
  return raw as OrderSnapshotV1;
}

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
    snapshot: parseSnapshotFromDb(row.snapshot),
    orderedAt: row.ordered_at ? (row.ordered_at as Date) : null,
    currency: row.currency != null ? String(row.currency) : null,
    totalCents:
      row.total_cents === null || row.total_cents === undefined ? null : Number(row.total_cents),
    financialStatus: row.financial_status != null ? String(row.financial_status) : null,
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

/**
 * Merge snapshot + index columns from Shopify order JSON (webhook or Admin fetch).
 */
export async function mergeOrderSnapshotFromShopifyPayload(
  tenantId: string,
  shopifyOrderId: string,
  payload: unknown
): Promise<boolean> {
  const built = buildOrderSnapshotFromShopifyOrder(payload);
  if (!built) return false;

  const n = await db('order_references')
    .where({ tenant_id: tenantId, shopify_order_id: shopifyOrderId })
    .update({
      snapshot: built.snapshot as unknown as Record<string, unknown>,
      ordered_at: built.orderedAt,
      currency: built.currency,
      total_cents: built.totalCents,
      financial_status: built.financialStatus,
    });
  return n > 0;
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
    .orderByRaw('COALESCE(ordered_at, created_at) DESC')
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

export async function getOrderReferenceByIdForUser(
  tenantId: string,
  userId: string,
  referenceId: string
): Promise<OrderReferenceRow | null> {
  const row = await db('order_references')
    .where({
      tenant_id: tenantId,
      user_id: userId,
      id: referenceId,
    })
    .first();
  if (!row) return null;
  return mapOrderReferenceRow(row as Record<string, unknown>);
}

/**
 * Rows needing snapshot backfill (matched user, no snapshot yet).
 */
export async function listOrderReferencesMissingSnapshot(
  limit: number
): Promise<Array<{ tenantId: string; shopifyOrderId: string }>> {
  const rows = await db('order_references')
    .select('tenant_id', 'shopify_order_id')
    .whereNotNull('user_id')
    .whereNull('snapshot')
    .orderBy('created_at', 'asc')
    .limit(Math.min(100, Math.max(1, limit)));

  return (rows as { tenant_id: string; shopify_order_id: string }[]).map((r) => ({
    tenantId: r.tenant_id,
    shopifyOrderId: r.shopify_order_id,
  }));
}

/**
 * Attach previously unmatched webhook rows to this user when the stored email matches.
 */
export async function claimOrphanOrderReferencesForUser(
  tenantId: string,
  userId: string,
  email: string
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;
  return db('order_references')
    .where({ tenant_id: tenantId })
    .whereNull('user_id')
    .whereNotNull('customer_email')
    .whereRaw('lower(trim(customer_email::text)) = ?', [normalized])
    .update({ user_id: userId });
}

export type SyncOrdersFromShopifyResult = {
  claimedRows: number;
  fetchedFromShopify: number;
  upserted: number;
  snapshotsWritten: number;
  errors: number;
};

export type ManualClaimOrderResult =
  | { ok: true; orderReferenceId: string; shopifyOrderId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'MISSING_CONFIRMATION' };

/**
 * Pull orders from Shopify Admin for this email, upsert references for this user, and merge snapshots.
 * Use for past orders before webhooks or when email matching failed on create.
 */
export async function syncOrderReferencesFromShopifyForUser(
  tenantId: string,
  userId: string,
  email: string
): Promise<SyncOrdersFromShopifyResult> {
  const normalized = email.trim().toLowerCase();
  const out: SyncOrdersFromShopifyResult = {
    claimedRows: 0,
    fetchedFromShopify: 0,
    upserted: 0,
    snapshotsWritten: 0,
    errors: 0,
  };
  if (!normalized) return out;

  out.claimedRows = await claimOrphanOrderReferencesForUser(tenantId, userId, normalized);

  const maxPages = 30;
  let sinceId: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    let page: Record<string, unknown>[];
    try {
      page = await fetchShopifyAdminOrdersByCustomerEmail(tenantId, normalized, sinceId);
    } catch {
      out.errors++;
      break;
    }
    if (!page.length) break;
    out.fetchedFromShopify += page.length;

    for (const order of page) {
      try {
        const rawId = order.id as number | string | undefined;
        if (rawId === undefined || rawId === null) continue;
        const shopifyOrderId = String(rawId);
        const orderNumber =
          typeof order.order_number === 'number' ? order.order_number : null;
        const emailRaw = order.email;
        const customerEmail =
          emailRaw && typeof emailRaw === 'string'
            ? emailRaw.trim().toLowerCase()
            : normalized;

        await upsertOrderReference({
          tenantId,
          shopifyOrderId,
          shopifyOrderNumber: orderNumber,
          userId,
          customerEmail,
        });
        out.upserted++;

        let merged = await mergeOrderSnapshotFromShopifyPayload(tenantId, shopifyOrderId, order);
        if (!merged) {
          const full = await fetchShopifyAdminOrderJson(tenantId, shopifyOrderId);
          if (full) {
            merged = await mergeOrderSnapshotFromShopifyPayload(tenantId, shopifyOrderId, full);
          }
        }
        if (merged) out.snapshotsWritten++;
      } catch {
        out.errors++;
      }
    }

    if (page.length < 50) break;
    const last = page[page.length - 1];
    const lid = last?.id;
    sinceId = lid !== undefined && lid !== null ? String(lid) : undefined;
    if (!sinceId) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  return out;
}

function normalizeLookupValue(v: unknown): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/\s+/g, '');
}

/**
 * Manual claim flow: find an order by customer email + confirmation number,
 * then attach it to this user and persist snapshot data.
 */
export async function claimOrderFromShopifyByEmailAndConfirmation(
  tenantId: string,
  userId: string,
  orderEmail: string,
  confirmationOrOrderNumber: string
): Promise<ManualClaimOrderResult> {
  const normalizedEmail = String(orderEmail || '').trim().toLowerCase();
  const normalizedLookup = normalizeLookupValue(confirmationOrOrderNumber);
  if (!normalizedEmail || !normalizedLookup) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const maxPages = 20;
  let sinceId: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchShopifyAdminOrdersByCustomerEmail(tenantId, normalizedEmail, sinceId);
    if (!page.length) break;

    for (const order of page) {
      const rawId = order.id as string | number | undefined;
      if (rawId == null) continue;
      const shopifyOrderId = String(rawId);
      const o = order as Record<string, unknown>;
      const candidates = [
        normalizeLookupValue(o.confirmation_number),
        normalizeLookupValue(o.name),
        normalizeLookupValue(o.order_number),
      ].filter(Boolean);
      if (!candidates.includes(normalizedLookup)) continue;

      const emailRaw = o.email;
      const customerEmail =
        typeof emailRaw === 'string' && emailRaw.trim() ? emailRaw.trim().toLowerCase() : normalizedEmail;
      const orderNumber =
        typeof o.order_number === 'number' ? (o.order_number as number) : null;

      await upsertOrderReference({
        tenantId,
        shopifyOrderId,
        shopifyOrderNumber: orderNumber,
        userId,
        customerEmail,
      });
      let merged = await mergeOrderSnapshotFromShopifyPayload(tenantId, shopifyOrderId, order);
      if (!merged) {
        const full = await fetchShopifyAdminOrderJson(tenantId, shopifyOrderId);
        if (!full) return { ok: false, reason: 'MISSING_CONFIRMATION' };
        merged = await mergeOrderSnapshotFromShopifyPayload(tenantId, shopifyOrderId, full);
      }
      const row = await db('order_references')
        .select('id')
        .where({ tenant_id: tenantId, shopify_order_id: shopifyOrderId, user_id: userId })
        .first();
      return { ok: true, orderReferenceId: String((row as { id?: string } | undefined)?.id || ''), shopifyOrderId };
    }

    if (page.length < 50) break;
    const lastId = page[page.length - 1]?.id;
    sinceId = lastId != null ? String(lastId) : undefined;
    if (!sinceId) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  return { ok: false, reason: 'NOT_FOUND' };
}
