import { db } from '../config/database';
import type { Knex } from 'knex';
import { logAudit } from './audit.service';
import {
  getUhtdSuggestionsForProduct,
  getTopSuggestionScore,
  type UhtdSuggestionInputProduct,
} from './uhtdProductSuggestions.service';
import { insertPartInTransaction } from './pcdb.service';
import type { CreatePartInput } from '../types/uhtd.types';

export const UHTD_IMPORT_REJECT_REASONS = ['non_spa_category', 'duplicate', 'other'] as const;
export type UhtdImportRejectReasonCode = (typeof UHTD_IMPORT_REJECT_REASONS)[number];

export const SHOPIFY_MAP_BULK_REJECT_MAX = 200;

export function listingSnapshotPayload(row: {
  title: string;
  sku: string | null;
  barcode: string | null;
}): Record<string, string | null> {
  return { title: row.title, sku: row.sku, barcode: row.barcode };
}

function auditReason(actorEmail: string, action: string, detail?: string): string {
  return [`super_admin:${actorEmail}`, action, detail].filter(Boolean).join(' | ');
}

async function dismissOpenReviewForPos(
  trx: Knex.Transaction,
  posProductId: string,
  exceptReviewItemId?: string
): Promise<void> {
  let q = trx('uhtd_shopify_import_review_items').where({
    pos_product_id: posProductId,
    status: 'open',
  });
  if (exceptReviewItemId) q = q.whereNot('id', exceptReviewItemId);
  await q.update({
    status: 'dismissed',
    resolved_at: trx.fn.now(),
    updated_at: trx.fn.now(),
  });
}

export type ListInboxParams = {
  tenantId?: string;
  page: number;
  pageSize: number;
  search?: string;
  mappingStatus?: string;
  needsReverifyOnly?: boolean;
  includeConfirmed?: boolean;
};

export async function listShopifyMapInbox(params: ListInboxParams): Promise<{
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;

  const base = () => {
    let q = db('pos_products as pp')
      .join('tenants as t', 't.id', 'pp.tenant_id')
      .whereNull('pp.uhtd_import_rejected_at')
      .andWhere((qb: Knex.QueryBuilder) =>
        qb.where('t.pos_type', 'shopify').orWhereNotNull('pp.shopify_inventory_item_id')
      );

    if (params.tenantId) q = q.andWhere('pp.tenant_id', params.tenantId);
    if (params.mappingStatus) q = q.andWhere('pp.mapping_status', params.mappingStatus);
    else if (!params.includeConfirmed) q = q.whereNot('pp.mapping_status', 'confirmed');

    if (params.needsReverifyOnly) q = q.whereNotNull('pp.uhtd_import_needs_reverify_at');

    const term = params.search?.trim();
    if (term) {
      const like = `%${term.replace(/%/g, '\\%')}%`;
      q = q.andWhere((qb: Knex.QueryBuilder) =>
        qb
          .whereILike('pp.title', like)
          .orWhereILike('pp.sku', like)
          .orWhereILike('pp.barcode', like)
          .orWhereILike('pp.pos_product_id', like)
      );
    }
    return q;
  };

  const countRow = await base().clone().count('* as c').first();
  const total = parseInt(String((countRow as { c?: string })?.c ?? '0'), 10);

  const rows = await base()
    .clone()
    .select(
      'pp.id',
      'pp.tenant_id',
      'pp.title',
      'pp.sku',
      'pp.barcode',
      'pp.mapping_status',
      'pp.uhtd_part_id',
      'pp.last_synced_at',
      'pp.updated_at',
      'pp.uhtd_import_needs_reverify_at',
      'pp.pos_product_id',
      'pp.pos_variant_id',
      't.name as tenant_name',
      't.slug as tenant_slug'
    )
    .orderBy('pp.last_synced_at', 'desc')
    .orderBy('pp.updated_at', 'desc')
    .limit(pageSize)
    .offset(offset);

  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const product: UhtdSuggestionInputProduct = {
      id: r.id as string,
      title: (r.title as string) ?? null,
      sku: (r.sku as string | null) ?? null,
      barcode: (r.barcode as string | null) ?? null,
      description: null,
      vendor: null,
      tags: null,
    };
    const topScore = await getTopSuggestionScore(product, r.tenant_id as string);
    out.push({
      ...r,
      topSuggestionScore: topScore,
    });
  }

  return { rows: out, total, page, pageSize };
}

export async function getShopifyMapRowDetail(posProductId: string): Promise<{
  product: Record<string, unknown>;
  tenant: Record<string, unknown> | null;
  suggestions: Awaited<ReturnType<typeof getUhtdSuggestionsForProduct>>;
} | null> {
  const row = await db('pos_products as pp')
    .leftJoin('tenants as t', 't.id', 'pp.tenant_id')
    .where('pp.id', posProductId)
    .select(
      'pp.*',
      't.name as tenant_name',
      't.slug as tenant_slug',
      't.pos_type as tenant_pos_type'
    )
    .first();

  if (!row) return null;

  const product: UhtdSuggestionInputProduct = {
    id: row.id,
    title: row.title ?? null,
    sku: row.sku ?? null,
    barcode: row.barcode ?? null,
    description: row.description ?? null,
    vendor: row.vendor ?? null,
    product_type: row.product_type ?? null,
    tags: row.tags ?? null,
  };

  const suggestions = await getUhtdSuggestionsForProduct(product, row.tenant_id);

  const { tenant_name, tenant_slug, tenant_pos_type, ...pp } = row;
  return {
    product: pp,
    tenant: {
      name: tenant_name,
      slug: tenant_slug,
      posType: tenant_pos_type,
      id: row.tenant_id,
    },
    suggestions,
  };
}

export async function rejectShopifyMapRow(
  posProductId: string,
  reasonCode: UhtdImportRejectReasonCode,
  note: string | undefined,
  actorEmail: string
): Promise<Record<string, unknown> | null> {
  if (!UHTD_IMPORT_REJECT_REASONS.includes(reasonCode)) return null;

  const existing = await db('pos_products').where({ id: posProductId }).first();
  if (!existing) return null;

  const now = new Date();
  const updatedRows = await db.transaction(async (trx) => {
    await dismissOpenReviewForPos(trx, posProductId);
    return trx('pos_products')
      .where({ id: posProductId })
      .update({
        uhtd_import_rejected_at: now,
        uhtd_import_reject_reason_code: reasonCode,
        uhtd_import_reject_note: note ?? null,
        uhtd_import_rejected_by: actorEmail,
        updated_at: now,
      })
      .returning('*');
  });
  const updated = updatedRows[0];

  await logAudit(
    'pos_products',
    posProductId,
    'UPDATE',
    existing,
    updated,
    undefined,
    auditReason(actorEmail, 'uhtd_import_reject', reasonCode)
  );

  return updated ?? null;
}

export async function bulkRejectShopifyMapRows(
  posProductIds: string[],
  reasonCode: UhtdImportRejectReasonCode,
  note: string | undefined,
  actorEmail: string
): Promise<{ updated: number; skipped: number }> {
  const ids = [...new Set(posProductIds)].filter(Boolean).slice(0, SHOPIFY_MAP_BULK_REJECT_MAX);
  if (!ids.length || !UHTD_IMPORT_REJECT_REASONS.includes(reasonCode)) {
    return { updated: 0, skipped: posProductIds.length };
  }

  let updated = 0;
  for (const id of ids) {
    const row = await rejectShopifyMapRow(id, reasonCode, note, actorEmail);
    if (row) updated += 1;
  }
  return { updated, skipped: posProductIds.length - updated };
}

async function applyConfirmedMapping(
  trx: Knex.Transaction,
  posProductId: string,
  partId: string,
  mappingConfidence: number | null | undefined,
  actorEmail: string,
  existing: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const title = String(existing.title ?? '');
  const sku = (existing.sku as string | null) ?? null;
  const barcode = (existing.barcode as string | null) ?? null;
  const snap = listingSnapshotPayload({ title, sku, barcode });

  const [row] = await trx('pos_products')
    .where({ id: posProductId })
    .update({
      uhtd_part_id: partId,
      mapping_status: 'confirmed',
      mapping_confidence:
        typeof mappingConfidence === 'number' && Number.isFinite(mappingConfidence)
          ? mappingConfidence
          : null,
      mapped_by: null,
      mapped_at: trx.fn.now(),
      mapping_actor_email: actorEmail,
      shopify_listing_snapshot: snap,
      uhtd_import_needs_reverify_at: null,
      updated_at: trx.fn.now(),
    })
    .returning('*');

  return row as Record<string, unknown>;
}

export async function publishLinkExistingPart(
  posProductId: string,
  uhtdPartId: string,
  mappingConfidence: number | null | undefined,
  actorEmail: string,
  opts?: { exceptReviewItemId?: string }
): Promise<{ ok: true; product: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  const existing = await db('pos_products').where({ id: posProductId }).first();
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'pos_product not found' };
  if (existing.uhtd_import_rejected_at) {
    return { ok: false, code: 'INVALID_STATE', message: 'product is rejected' };
  }

  const part = await db('pcdb_parts').where({ id: uhtdPartId }).whereNull('deleted_at').first();
  if (!part) return { ok: false, code: 'NOT_FOUND', message: 'part not found' };

  const updated = await db.transaction(async (trx) => {
    await dismissOpenReviewForPos(trx, posProductId, opts?.exceptReviewItemId);
    return applyConfirmedMapping(trx, posProductId, uhtdPartId, mappingConfidence, actorEmail, existing);
  });

  await logAudit(
    'pos_products',
    posProductId,
    'UPDATE',
    existing,
    updated,
    undefined,
    auditReason(actorEmail, 'uhtd_shopify_map_link', uhtdPartId)
  );

  return { ok: true, product: updated };
}

export async function publishCreatePart(
  posProductId: string,
  partInput: CreatePartInput,
  mappingConfidence: number | null | undefined,
  actorEmail: string,
  opts?: { exceptReviewItemId?: string }
): Promise<
  { ok: true; product: Record<string, unknown>; partId: string } | { ok: false; code: string; message: string }
> {
  const existing = await db('pos_products').where({ id: posProductId }).first();
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'pos_product not found' };
  if (existing.uhtd_import_rejected_at) {
    return { ok: false, code: 'INVALID_STATE', message: 'product is rejected' };
  }

  let newPartRow: Record<string, unknown>;
  let updated: Record<string, unknown>;

  await db.transaction(async (trx) => {
    await dismissOpenReviewForPos(trx, posProductId, opts?.exceptReviewItemId);
    newPartRow = await insertPartInTransaction(trx, {
      ...partInput,
      dataSource: partInput.dataSource ?? `super_admin_map_from_shopify:${actorEmail}`,
    });
    const partId = String(newPartRow.id);
    updated = await applyConfirmedMapping(trx, posProductId, partId, mappingConfidence, actorEmail, existing);
  });

  const partId = String(newPartRow!.id);
  await logAudit('pcdb_parts', partId, 'INSERT', null, newPartRow!, undefined, auditReason(actorEmail, 'uhtd_shopify_map_create'));
  await logAudit(
    'pos_products',
    posProductId,
    'UPDATE',
    existing,
    updated!,
    undefined,
    auditReason(actorEmail, 'uhtd_shopify_map_create_publish', partId)
  );

  return { ok: true, product: updated!, partId };
}

export async function sendShopifyMapForReview(
  posProductId: string,
  draftPayload: Record<string, unknown>,
  actorEmail: string
): Promise<{ ok: true; reviewItem: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  const existing = await db('pos_products').where({ id: posProductId }).first();
  if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'pos_product not found' };
  if (existing.uhtd_import_rejected_at) {
    return { ok: false, code: 'INVALID_STATE', message: 'product is rejected' };
  }

  const title = String(existing.title ?? '');
  const sku = (existing.sku as string | null) ?? null;
  const barcode = (existing.barcode as string | null) ?? null;
  const images = existing.images;
  const enriched = {
    ...draftPayload,
    shopify: { title, sku, barcode, images },
  };

  const open = await db('uhtd_shopify_import_review_items')
    .where({ pos_product_id: posProductId, status: 'open' })
    .first();

  let row: Record<string, unknown>;
  if (open) {
    [row] = await db('uhtd_shopify_import_review_items')
      .where({ id: open.id })
      .update({
        draft_payload: enriched,
        source_super_admin_email: actorEmail,
        updated_at: db.fn.now(),
      })
      .returning('*');
  } else {
    [row] = await db('uhtd_shopify_import_review_items')
      .insert({
        pos_product_id: posProductId,
        tenant_id: existing.tenant_id,
        status: 'open',
        draft_payload: enriched,
        source_super_admin_email: actorEmail,
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .returning('*');
  }

  await logAudit(
    'pos_products',
    posProductId,
    'UPDATE',
    null,
    { uhtd_send_for_review: true, review_item_id: row.id },
    undefined,
    auditReason(actorEmail, 'uhtd_send_for_review')
  );

  return { ok: true, reviewItem: row };
}

export async function listShopifyImportReviewQueue(params: {
  page: number;
  pageSize: number;
  tenantId?: string;
}): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const offset = (page - 1) * pageSize;

  let base = db('uhtd_shopify_import_review_items as r')
    .join('pos_products as pp', 'pp.id', 'r.pos_product_id')
    .join('tenants as t', 't.id', 'r.tenant_id')
    .where('r.status', 'open');

  if (params.tenantId) base = base.andWhere('r.tenant_id', params.tenantId);

  const countRow = await base.clone().count('* as c').first();
  const total = parseInt(String((countRow as { c?: string })?.c ?? '0'), 10);

  const rows = await base
    .clone()
    .select(
      'r.id',
      'r.pos_product_id',
      'r.tenant_id',
      'r.status',
      'r.draft_payload',
      'r.source_super_admin_email',
      'r.created_at',
      'r.updated_at',
      'pp.title as pos_title',
      'pp.sku as pos_sku',
      'pp.barcode as pos_barcode',
      't.name as tenant_name',
      't.slug as tenant_slug'
    )
    .orderBy('r.created_at', 'asc')
    .limit(pageSize)
    .offset(offset);

  return { rows, total, page, pageSize };
}

export async function dismissShopifyImportReview(
  reviewItemId: string,
  actorEmail: string
): Promise<Record<string, unknown> | null> {
  const row = await db('uhtd_shopify_import_review_items').where({ id: reviewItemId }).first();
  if (!row || row.status !== 'open') return null;

  const [updated] = await db('uhtd_shopify_import_review_items')
    .where({ id: reviewItemId })
    .update({
      status: 'dismissed',
      resolved_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  await logAudit(
    'pos_products',
    row.pos_product_id,
    'UPDATE',
    null,
    { review_dismissed: reviewItemId },
    undefined,
    auditReason(actorEmail, 'uhtd_shopify_review_dismiss')
  );

  return updated ?? null;
}

export async function approveShopifyImportReview(
  reviewItemId: string,
  body:
    | { mode: 'link'; uhtdPartId: string; mappingConfidence?: number }
    | { mode: 'create'; part: CreatePartInput; mappingConfidence?: number },
  actorEmail: string
): Promise<
  | { ok: true; product: Record<string, unknown>; partId: string }
  | { ok: false; code: string; message: string }
> {
  const row = await db('uhtd_shopify_import_review_items').where({ id: reviewItemId }).first();
  if (!row || row.status !== 'open') {
    return { ok: false, code: 'NOT_FOUND', message: 'review item not found or not open' };
  }

  const posProductId = row.pos_product_id as string;
  const mappingConfidence = body.mappingConfidence;

  if (body.mode === 'link') {
    const pub = await publishLinkExistingPart(posProductId, body.uhtdPartId, mappingConfidence, actorEmail, {
      exceptReviewItemId: reviewItemId,
    });
    if (!pub.ok) return pub;
    await db('uhtd_shopify_import_review_items').where({ id: reviewItemId }).update({
      status: 'approved',
      resolved_part_id: body.uhtdPartId,
      resolved_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
    return { ok: true, product: pub.product, partId: body.uhtdPartId };
  }

  const created = await publishCreatePart(posProductId, body.part, mappingConfidence, actorEmail, {
    exceptReviewItemId: reviewItemId,
  });
  if (!created.ok) return created;

  await db('uhtd_shopify_import_review_items').where({ id: reviewItemId }).update({
    status: 'approved',
    resolved_part_id: created.partId,
    resolved_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  return { ok: true, product: created.product, partId: created.partId };
}
