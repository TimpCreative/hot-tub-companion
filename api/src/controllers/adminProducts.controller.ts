import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';

function requireManageProducts(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_products === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_products', 403);
    return false;
  }
  return true;
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const {
    mappingStatus,
    isHidden,
    search,
    page = '1',
    pageSize = '25',
  } = req.query as Record<string, string>;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  let query = db('pos_products')
    .where({ tenant_id: tenantId })
    .select(
      'id',
      'title',
      'sku',
      'barcode',
      'price',
      'inventory_quantity',
      'mapping_status',
      'mapping_confidence',
      'is_hidden',
      'uhtd_part_id',
      'pos_product_id',
      'pos_variant_id',
      'last_synced_at',
      'updated_at'
    );

  if (mappingStatus) {
    query = query.where('mapping_status', mappingStatus);
  }
  if (isHidden === 'true') query = query.where('is_hidden', true);
  if (isHidden === 'false') query = query.where('is_hidden', false);

  if (search) {
    const s = `%${search}%`;
    query = query.where((qb: any) => {
      qb.where('title', 'ilike', s).orWhere('sku', 'ilike', s).orWhere('barcode', 'ilike', s);
    });
  }

  const countQuery = query.clone().clearSelect().clearOrder().count('* as count').first();
  query = query
    .orderBy('updated_at', 'desc')
    .limit(ps)
    .offset((p - 1) * ps);

  const [rows, countRow] = await Promise.all([query, countQuery]);
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  success(
    res,
    rows,
    undefined,
    { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) }
  );
}

export async function setVisibility(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
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
  const tenantId = (req as any).tenant?.id as string | undefined;
  const { id } = req.params;
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const product = await db('pos_products')
    .where({ id, tenant_id: tenantId })
    .select('id', 'title', 'sku', 'barcode')
    .first();

  if (!product) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  const suggestions: Array<{ partId: string; name: string; partNumber: string | null; manufacturer: string | null; score: number; reason: string }> = [];

  // 1) Barcode match (highest confidence)
  if (product.barcode) {
    const barcodeMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) => qb.where('upc', product.barcode).orWhere('ean', product.barcode))
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer');

    for (const m of barcodeMatches) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: 0.95,
        reason: 'barcode',
      });
    }
  }

  // 2) SKU / part_number match
  if (product.sku) {
    const skuMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: any) =>
        qb.whereRaw('LOWER(part_number) = LOWER(?)', [product.sku])
          .orWhereRaw('? = ANY(sku_aliases)', [product.sku])
      )
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer');

    for (const m of skuMatches) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: 0.75,
        reason: 'sku',
      });
    }
  }

  // 3) Name similarity (fallback)
  if (product.title) {
    const nameMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        db.raw('similarity(name, ?) as score', [product.title])
      )
      .whereRaw('similarity(name, ?) >= 0.15', [product.title])
      .orderBy('score', 'desc')
      .limit(10);

    for (const m of nameMatches as any[]) {
      suggestions.push({
        partId: m.id,
        name: m.name,
        partNumber: m.part_number,
        manufacturer: m.manufacturer,
        score: Number(m.score) || 0,
        reason: 'name_similarity',
      });
    }
  }

  // Deduplicate by partId, keep best score
  const best = new Map<string, typeof suggestions[number]>();
  for (const s of suggestions) {
    const cur = best.get(s.partId);
    if (!cur || s.score > cur.score) best.set(s.partId, s);
  }

  const out = Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, 10);
  success(res, out);
}

export async function confirmMapping(req: Request, res: Response): Promise<void> {
  if (!requireManageProducts(req, res)) return;
  const tenantId = (req as any).tenant?.id as string | undefined;
  const userId = (req as any).user?.id as string | undefined;
  const { id } = req.params;
  const { uhtdPartId, mappingConfidence } = req.body as { uhtdPartId?: string; mappingConfidence?: number };

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
  const tenantId = (req as any).tenant?.id as string | undefined;
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

