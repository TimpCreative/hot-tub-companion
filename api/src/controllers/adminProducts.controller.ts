import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import {
  parseAdminProductFilters,
  applyAdminProductFilters,
  applyAdminProductSort,
  filtersForBulkToken,
} from '../services/adminProductsQuery.service';
import {
  signBulkProductSelectionToken,
  verifyBulkProductSelectionToken,
  BULK_APPLY_MAX_ROWS,
} from '../utils/productBulkSelection';

function requireManageProducts(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_products === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_products', 403);
    return false;
  }
  return true;
}

function tenantIdFromReq(req: Request): string | null {
  return ((req as any).tenant?.id as string | undefined) ?? null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += c;
    }
  }
  row.push(cur);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const EXPORT_ROW_CHUNK = 2000;

export async function listProducts(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const q = req.query as Record<string, string | undefined>;
  const { page = '1', pageSize = '25' } = q;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const filters = parseAdminProductFilters(q);

  let query = db('pos_products')
    .select(
      'pos_products.id',
      'pos_products.title',
      'pos_products.description',
      'pos_products.vendor',
      'pos_products.product_type',
      'pos_products.tags',
      'pos_products.sku',
      'pos_products.barcode',
      'pos_products.price',
      'pos_products.compare_at_price',
      'pos_products.inventory_quantity',
      'pos_products.mapping_status',
      'pos_products.mapping_confidence',
      'pos_products.is_hidden',
      'pos_products.uhtd_part_id',
      'pos_products.pos_product_id',
      'pos_products.pos_variant_id',
      'pos_products.last_synced_at',
      'pos_products.updated_at',
      db.raw(`(
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'shopifyCollectionId', c.shopify_collection_id,
              'title', c.title,
              'handle', c.handle
            ) ORDER BY c.title NULLS LAST
          ),
          '[]'::json
        )
        FROM pos_product_shopify_collections m
        JOIN pos_shopify_collections c
          ON c.tenant_id = m.tenant_id
         AND c.shopify_collection_id = m.shopify_collection_id
        WHERE m.pos_product_id = pos_products.id
      ) as collections`),
      db.raw(`(
        CASE
          WHEN jsonb_typeof(pos_products.images) = 'array'
           AND jsonb_array_length(pos_products.images) > 0
          THEN pos_products.images->>0
          ELSE NULL
        END
      ) as first_image_url`)
    );

  applyAdminProductFilters(query, tenantId, filters);
  applyAdminProductSort(query, filters.sort);

  const countQ = query.clone().clearSelect().clearOrder().count('* as count').first();
  query = query.limit(ps).offset((p - 1) * ps);

  const [rows, countRow] = await Promise.all([query, countQ]);
  const total = parseInt(String((countRow as { count?: string })?.count ?? '0'), 10);

  success(res, rows, undefined, {
    page: p,
    pageSize: ps,
    total,
    totalPages: Math.ceil(total / ps),
  });
}

export async function exportProductsCsv(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const filters = parseAdminProductFilters(req.query as Record<string, string | undefined>);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="htc-products-export.csv"');
  res.write(
    [
      'id',
      'pos_product_id',
      'pos_variant_id',
      'is_hidden',
      'uhtd_part_id',
      'mapping_status',
    ].join(',') + '\n'
  );

  let offset = 0;
  for (;;) {
    let chunkQ = db('pos_products')
      .select(
        'pos_products.id',
        'pos_products.pos_product_id',
        'pos_products.pos_variant_id',
        'pos_products.is_hidden',
        'pos_products.uhtd_part_id',
        'pos_products.mapping_status'
      )
      .orderBy('pos_products.id', 'asc');
    applyAdminProductFilters(chunkQ, tenantId, filters);
    const chunk = await chunkQ.limit(EXPORT_ROW_CHUNK).offset(offset);
    if (!chunk.length) break;
    for (const row of chunk as any[]) {
      const line = [
        csvEscape(String(row.id)),
        csvEscape(String(row.pos_product_id ?? '')),
        csvEscape(row.pos_variant_id != null ? String(row.pos_variant_id) : ''),
        row.is_hidden ? 'true' : 'false',
        csvEscape(row.uhtd_part_id != null ? String(row.uhtd_part_id) : ''),
        csvEscape(String(row.mapping_status ?? '')),
      ].join(',');
      res.write(line + '\n');
    }
    offset += chunk.length;
    if (chunk.length < EXPORT_ROW_CHUNK) break;
  }
  res.end();
}

export async function importProductsCsv(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const file = (req as any).file as { buffer?: Buffer } | undefined;
  const mode = String((req.body as { mode?: string })?.mode || 'dry_run').toLowerCase();
  const apply = mode === 'apply';

  if (!file?.buffer?.length) {
    error(res, 'VALIDATION_ERROR', 'CSV file is required', 400);
    return;
  }

  const text = file.buffer.toString('utf8');
  const table = parseCsvRows(text);
  if (table.length < 2) {
    error(res, 'VALIDATION_ERROR', 'CSV must include a header row and at least one data row', 400);
    return;
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iId = idx('id');
  const iPos = idx('pos_product_id');
  const iVar = idx('pos_variant_id');
  const iHidden = idx('is_hidden');
  const iPart = idx('uhtd_part_id');
  if (iHidden < 0) {
    error(res, 'VALIDATION_ERROR', 'CSV must include is_hidden column', 400);
    return;
  }
  if (iId < 0 && (iPos < 0 || iVar < 0)) {
    error(res, 'VALIDATION_ERROR', 'CSV must include id or pos_product_id + pos_variant_id', 400);
    return;
  }

  type RowErr = { row: number; message: string };
  const errors: RowErr[] = [];
  type UhtdSpec =
    | { mode: 'omit' }
    | { mode: 'clear' }
    | { mode: 'set'; partId: string };
  const parsedRows: Array<{ rowNum: number; id: string; is_hidden: boolean; uhtd: UhtdSpec }> = [];

  for (let r = 1; r < table.length; r++) {
    const cols = table[r];
    const rowNum = r + 1;
    let id: string | null = iId >= 0 ? cols[iId]?.trim() || null : null;
    const posPid = iPos >= 0 ? cols[iPos]?.trim() || null : null;
    const posVid = iVar >= 0 ? cols[iVar]?.trim() || null : null;
    const hiddenRaw = cols[iHidden]?.trim().toLowerCase();
    const isHidden = hiddenRaw === 'true' || hiddenRaw === '1' || hiddenRaw === 'yes';
    const isShown = hiddenRaw === 'false' || hiddenRaw === '0' || hiddenRaw === 'no';
    if (!isHidden && !isShown) {
      errors.push({ row: rowNum, message: 'is_hidden must be true or false' });
      continue;
    }

    let uhtd: UhtdSpec = { mode: 'omit' };
    if (iPart >= 0) {
      const partCell = cols[iPart]?.trim() ?? '';
      if (partCell === '') {
        uhtd = { mode: 'clear' };
      } else {
        const part = await db('pcdb_parts').where({ id: partCell }).whereNull('deleted_at').first();
        if (!part) {
          errors.push({ row: rowNum, message: 'Invalid uhtd_part_id' });
          continue;
        }
        uhtd = { mode: 'set', partId: partCell };
      }
    }

    if (!id && posPid) {
      const q = db('pos_products').where({ tenant_id: tenantId, pos_product_id: posPid });
      if (posVid != null && posVid !== '') q.andWhere({ pos_variant_id: posVid });
      const found = await q.select('id').first();
      id = found?.id ?? null;
    }

    if (!id) {
      errors.push({ row: rowNum, message: 'Product row not found for this tenant' });
      continue;
    }

    const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
    if (!existing) {
      errors.push({ row: rowNum, message: 'Product not found' });
      continue;
    }

    parsedRows.push({ rowNum, id, is_hidden: isHidden, uhtd });
  }

  if (apply && errors.length === 0 && parsedRows.length) {
    const userId = (req as any).user?.id as string | undefined;
    await db.transaction(async (trx) => {
      for (const pr of parsedRows) {
        const patch: Record<string, unknown> = {
          is_hidden: pr.is_hidden,
          hidden_at: pr.is_hidden ? trx.fn.now() : null,
          hidden_by: pr.is_hidden ? userId ?? null : null,
          updated_at: trx.fn.now(),
        };
        if (pr.uhtd.mode === 'clear') {
          patch.uhtd_part_id = null;
          patch.mapping_status = 'unmapped';
          patch.mapping_confidence = null;
          patch.mapped_by = null;
          patch.mapped_at = null;
        } else if (pr.uhtd.mode === 'set') {
          patch.uhtd_part_id = pr.uhtd.partId;
          patch.mapping_status = 'confirmed';
          patch.mapped_at = trx.fn.now();
          patch.mapped_by = userId ?? null;
        }
        await trx('pos_products').where({ id: pr.id, tenant_id: tenantId }).update(patch);
      }
    });
  }

  success(res, {
    mode: apply ? 'apply' : 'dry_run',
    rowsRead: table.length - 1,
    rowsValid: parsedRows.length,
    errors,
    applied: apply && errors.length === 0 && parsedRows.length > 0,
  });
}

export async function bulkSelection(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const body = req.body as Record<string, string | undefined>;
  const filters = filtersForBulkToken(parseAdminProductFilters(body));

  let countQ = db('pos_products').whereRaw('1=1');
  applyAdminProductFilters(countQ, tenantId, filters);
  const countRow = await countQ.clone().clearSelect().clearOrder().count('* as count').first();
  const count = parseInt(String((countRow as { count?: string })?.count ?? '0'), 10);

  if (count > BULK_APPLY_MAX_ROWS) {
    error(
      res,
      'VALIDATION_ERROR',
      `Selection exceeds maximum (${BULK_APPLY_MAX_ROWS} rows). Narrow your filters.`,
      400
    );
    return;
  }

  const { token, expiresAtIso } = signBulkProductSelectionToken(tenantId, filters);
  success(res, { count, selection_token: token, expires_at: expiresAtIso });
}

export async function bulkApply(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const { selection_token: selectionToken, action, payload } = req.body as {
    selection_token?: string;
    action?: string;
    payload?: Record<string, unknown>;
  };

  if (!selectionToken) {
    error(res, 'VALIDATION_ERROR', 'selection_token is required', 400);
    return;
  }

  const verified = verifyBulkProductSelectionToken(selectionToken);
  if (!verified || verified.tenantId !== tenantId) {
    error(res, 'VALIDATION_ERROR', 'Invalid or expired selection_token', 400);
    return;
  }

  const filters = verified.filters;
  let countQ = db('pos_products').whereRaw('1=1');
  applyAdminProductFilters(countQ, tenantId, filters);
  const countRow = await countQ.clone().clearSelect().clearOrder().count('* as count').first();
  const count = parseInt(String((countRow as { count?: string })?.count ?? '0'), 10);

  if (count > BULK_APPLY_MAX_ROWS) {
    error(res, 'VALIDATION_ERROR', 'Selection too large', 400);
    return;
  }

  const idQuery = db('pos_products').select('id').whereRaw('1=1');
  applyAdminProductFilters(idQuery, tenantId, filters);
  const idRows = await idQuery;
  const ids = idRows.map((r: { id: string }) => r.id);

  const userId = (req as any).user?.id as string | undefined;
  let updated = 0;

  if (action === 'set_hidden') {
    if (typeof payload?.isHidden !== 'boolean') {
      error(res, 'VALIDATION_ERROR', 'payload.isHidden (boolean) is required for set_hidden', 400);
      return;
    }
    const isHidden = payload.isHidden;
    if (ids.length) {
      updated = await db('pos_products').whereIn('id', ids).update({
        is_hidden: isHidden,
        hidden_at: isHidden ? db.fn.now() : null,
        hidden_by: isHidden ? userId ?? null : null,
        updated_at: db.fn.now(),
      });
    }
  } else if (action === 'clear_mapping') {
    if (ids.length) {
      updated = await db('pos_products').whereIn('id', ids).update({
        uhtd_part_id: null,
        mapping_status: 'unmapped',
        mapping_confidence: null,
        mapped_by: null,
        mapped_at: null,
        updated_at: db.fn.now(),
      });
    }
  } else {
    error(res, 'VALIDATION_ERROR', 'Unknown action', 400);
    return;
  }

  success(res, { updated, matched: count });
}

export async function listShopifyCollections(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const rows = await db('pos_shopify_collections')
    .where({ tenant_id: tenantId })
    .select(
      'shopify_collection_id',
      'collection_type',
      'handle',
      'title',
      'updated_at'
    )
    .orderBy('title', 'asc')
    .orderBy('shopify_collection_id', 'asc');

  success(res, rows);
}

export async function listCollectionCategoryMaps(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const rows = await db('tenant_collection_category_map as m')
    .leftJoin('pos_shopify_collections as c', function join() {
      this.on('c.tenant_id', '=', 'm.tenant_id').andOn(
        'c.shopify_collection_id',
        '=',
        'm.shopify_collection_id'
      );
    })
    .join('pcdb_categories as cat', 'cat.id', 'm.pcdb_category_id')
    .where('m.tenant_id', tenantId)
    .whereNull('cat.deleted_at')
    .select(
      'm.shopify_collection_id',
      'm.pcdb_category_id',
      'c.title as collection_title',
      'c.handle as collection_handle',
      'cat.name as category_name',
      'cat.display_name as category_display_name'
    )
    .orderBy('c.title', 'asc');

  success(res, rows);
}

export async function upsertCollectionCategoryMap(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const shopifyCollectionId = decodeURIComponent(req.params.shopifyCollectionId || '').trim();
  const { pcdbCategoryId } = req.body as { pcdbCategoryId?: string };
  if (!shopifyCollectionId) {
    error(res, 'VALIDATION_ERROR', 'shopifyCollectionId is required', 400);
    return;
  }
  if (!pcdbCategoryId) {
    error(res, 'VALIDATION_ERROR', 'pcdbCategoryId is required', 400);
    return;
  }

  const cat = await db('pcdb_categories')
    .where({ id: pcdbCategoryId })
    .whereNull('deleted_at')
    .first();
  if (!cat) {
    error(res, 'NOT_FOUND', 'Category not found', 404);
    return;
  }

  const now = new Date();
  const [row] = await db('tenant_collection_category_map')
    .insert({
      tenant_id: tenantId,
      shopify_collection_id: shopifyCollectionId,
      pcdb_category_id: pcdbCategoryId,
      created_at: now,
      updated_at: now,
    })
    .onConflict(['tenant_id', 'shopify_collection_id'])
    .merge({
      pcdb_category_id: pcdbCategoryId,
      updated_at: now,
    })
    .returning('*');

  success(res, row);
}

export async function deleteCollectionCategoryMap(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const shopifyCollectionId = decodeURIComponent(req.params.shopifyCollectionId || '').trim();
  if (!shopifyCollectionId) {
    error(res, 'VALIDATION_ERROR', 'shopifyCollectionId is required', 400);
    return;
  }

  const n = await db('tenant_collection_category_map')
    .where({ tenant_id: tenantId, shopify_collection_id: shopifyCollectionId })
    .delete();
  if (!n) {
    error(res, 'NOT_FOUND', 'Mapping not found', 404);
    return;
  }
  success(res, { deleted: true });
}

export async function searchPcdbCategories(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const q = (req.query.q as string | undefined)?.trim() || '';
  let query = db('pcdb_categories').whereNull('deleted_at').select('id', 'name', 'display_name');
  if (q) {
    const s = `%${q}%`;
    query = query.andWhere((b) => {
      b.where('name', 'ilike', s).orWhere('display_name', 'ilike', s);
    });
  }
  const rows = await query.orderBy('sort_order', 'asc').limit(80);
  success(res, rows);
}

export async function setVisibility(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  const { isHidden } = req.body as { isHidden?: boolean };

  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (typeof isHidden !== 'boolean') {
    error(res, 'VALIDATION_ERROR', 'isHidden boolean is required', 400);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      is_hidden: isHidden,
      hidden_at: isHidden ? db.fn.now() : null,
      hidden_by: isHidden ? userId ?? null : null,
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}

export async function getUhtdSuggestions(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  const { id } = req.params;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const product = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .select(
      'id',
      'title',
      'sku',
      'barcode',
      'description',
      'vendor',
      'product_type',
      'tags'
    )
    .first();

  if (!product) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const collRows = await db('pos_product_shopify_collections')
    .where('pos_product_id', id)
    .select('shopify_collection_id');
  const collIds = collRows.map((r: { shopify_collection_id: string }) => r.shopify_collection_id);
  const mappedCategoryIds = new Set<string>();
  if (collIds.length) {
    const maps = await db('tenant_collection_category_map')
      .where({ tenant_id: tenantId })
      .whereIn('shopify_collection_id', collIds)
      .select('pcdb_category_id');
    for (const m of maps) mappedCategoryIds.add(m.pcdb_category_id);
  }

  const descPlain = product.description ? stripHtml(String(product.description)) : '';
  const descSnippet = descPlain.length > 2000 ? descPlain.slice(0, 2000) : descPlain;

  const suggestions: Array<{
    partId: string;
    name: string;
    partNumber: string | null;
    manufacturer: string | null;
    score: number;
    reason: string;
  }> = [];

  function pushSuggestion(
    row: {
      id: string;
      name: string;
      part_number: string | null;
      manufacturer: string | null;
      category_id?: string;
    },
    baseScore: number,
    baseReason: string
  ) {
    let score = baseScore;
    const reasons: string[] = [baseReason];
    if (
      product.vendor &&
      row.manufacturer &&
      String(product.vendor).trim().toLowerCase() === String(row.manufacturer).trim().toLowerCase()
    ) {
      score += 0.08;
      reasons.push('vendor_match');
    }
    if (row.category_id && mappedCategoryIds.size > 0 && mappedCategoryIds.has(row.category_id)) {
      score += 0.12;
      reasons.push('collection_category');
    }
    if (Array.isArray(product.tags) && product.tags.length && row.name) {
      const nameLower = row.name.toLowerCase();
      for (const t of product.tags) {
        if (t && nameLower.includes(String(t).toLowerCase())) {
          score += 0.04;
          reasons.push('tag_overlap');
          break;
        }
      }
    }
    suggestions.push({
      partId: row.id,
      name: row.name,
      partNumber: row.part_number,
      manufacturer: row.manufacturer,
      score: Math.min(score, 0.99),
      reason: reasons.join('+'),
    });
  }

  if (product.barcode) {
    const barcodeMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) => qb.where('upc', product.barcode).orWhere('ean', product.barcode))
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer', 'category_id');

    for (const m of barcodeMatches) {
      pushSuggestion(m, 0.95, 'barcode');
    }
  }

  if (product.sku) {
    const skuMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) =>
        qb.whereRaw('LOWER(part_number) = LOWER(?)', [product.sku]).orWhereRaw('? = ANY(sku_aliases)', [
          product.sku,
        ])
      )
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer', 'category_id');

    for (const m of skuMatches) {
      pushSuggestion(m, 0.75, 'sku');
    }
  }

  if (product.title) {
    const nameMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        'category_id',
        db.raw('similarity(name, ?) as score', [product.title])
      )
      .whereRaw('similarity(name, ?) >= 0.15', [product.title])
      .orderBy('score', 'desc')
      .limit(10);

    for (const m of nameMatches as any[]) {
      pushSuggestion(
        {
          id: m.id,
          name: m.name,
          part_number: m.part_number,
          manufacturer: m.manufacturer,
          category_id: m.category_id,
        },
        Number(m.score) || 0,
        'name_similarity'
      );
    }
  }

  if (descSnippet.length > 12) {
    const descMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        'category_id',
        db.raw('similarity(name, ?) as score', [descSnippet])
      )
      .whereRaw('similarity(name, ?) >= 0.12', [descSnippet])
      .orderBy('score', 'desc')
      .limit(8);

    for (const m of descMatches as any[]) {
      pushSuggestion(
        {
          id: m.id,
          name: m.name,
          part_number: m.part_number,
          manufacturer: m.manufacturer,
          category_id: m.category_id,
        },
        Math.min(0.35, Number(m.score) || 0),
        'description_similarity'
      );
    }
  }

  const best = new Map<string, (typeof suggestions)[number]>();
  for (const s of suggestions) {
    const cur = best.get(s.partId);
    if (!cur || s.score > cur.score) best.set(s.partId, s);
  }

  const out = Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, 10);
  success(res, out);
}

export async function confirmMapping(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  const { uhtdPartId, mappingConfidence } = req.body as {
    uhtdPartId?: string;
    mappingConfidence?: number;
  };

  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }
  if (!uhtdPartId) {
    error(res, 'VALIDATION_ERROR', 'uhtdPartId is required', 400);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const part = await db('pcdb_parts').where({ id: uhtdPartId }).whereNull('deleted_at').first();
  if (!part) {
    error(res, 'NOT_FOUND', 'UHTD part not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      uhtd_part_id: uhtdPartId,
      mapping_status: 'confirmed',
      mapping_confidence: typeof mappingConfidence === 'number' ? mappingConfidence : null,
      mapped_by: userId ?? null,
      mapped_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}

export async function clearMapping(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = tenantIdFromReq(req);
  const { id } = req.params;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const existing = await db('pos_products').where({ id, tenant_id: tenantId }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const [updated] = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .update({
      uhtd_part_id: null,
      mapping_status: 'unmapped',
      mapping_confidence: null,
      mapped_by: null,
      mapped_at: null,
      updated_at: db.fn.now(),
    })
    .returning('*');

  success(res, updated);
}
